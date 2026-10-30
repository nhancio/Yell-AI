"""Razorpay payment integration for premium subscriptions."""

import hashlib
import hmac
import logging
from datetime import datetime, timedelta
from typing import Any, Optional
from urllib.parse import urlencode

import razorpay
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.models.database import async_session, ensure_tables
from app.models.onboarding import UserOnboarding
from app.models.user import User
from app.services.composio_service import normalize_phone

logger = logging.getLogger(__name__)
settings = get_settings()
PRODUCT_TAG = "astra"


class PaymentService:
    """Handle Razorpay payment link creation, verification, and premium activation."""

    def __init__(self) -> None:
        if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
            self.client = razorpay.Client(
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
            )
        else:
            self.client = None
            logger.warning("Razorpay credentials not configured")

    async def create_payment_link(
        self, phone_number: str = "", user_id: Optional[int] = None, plan: str = "pro"
    ) -> Optional[str]:
        """Create a Razorpay payment link for Pro or Business (prices from settings) and return the short URL."""
        if not self.client:
            logger.error("Razorpay client not initialised")
            return None

        is_biz = plan.lower() in ("business", "biz", "team")
        amount = settings.BUSINESS_PRICE_PAISE if is_biz else settings.MONTHLY_PRICE_PAISE
        limit = settings.BUSINESS_DAILY_LIMIT if is_biz else settings.PAID_DAILY_LIMIT
        desc = f"Astra AI {'Business' if is_biz else 'Pro'} ({limit} messages/day) - 30 Days"
        norm_phone = normalize_phone(phone_number) if phone_number else ""

        try:
            notes: dict[str, str] = {
                # The Razorpay account is shared with other products; the webhook only
                # grants Astra plans for links carrying this marker.
                "product": PRODUCT_TAG,
                "plan_tier": "business" if is_biz else "pro",
            }
            if norm_phone:
                notes["phone_number"] = norm_phone
            if user_id is not None:
                notes["user_id"] = str(user_id)

            data: dict[str, Any] = {
                "amount": amount,
                "currency": "INR",
                "description": desc,
                "notify": {
                    "sms": bool(phone_number),
                    "email": False,
                    "whatsapp": False,
                },
                "callback_url": f"{settings.APP_URL}/payment/success",
                "callback_method": "get",
                "notes": notes,
            }
            if phone_number:
                data["customer"] = {"contact": phone_number}

            link = await run_in_threadpool(self.client.payment_link.create, data)
            short_url = link.get("short_url", "")
            logger.info(
                "Created payment link for %s: %s", phone_number or "direct-checkout", short_url
            )
            return short_url
        except Exception as exc:
            logger.error("Razorpay create_payment_link error: %s", exc)
            return None

    def verify_payment(self, payment_id: str, signature: str, body: bytes) -> bool:
        """Verify a Razorpay webhook signature.

        Args:
            payment_id: The payment ID from the event.
            signature: The X-Razorpay-Signature header value.
            body: Raw request body bytes.

        Returns:
            True if the signature is valid.
        """
        # A blank secret would let anyone compute a "valid" signature and grant themselves Pro
        secret = settings.RAZORPAY_WEBHOOK_SECRET or settings.RAZORPAY_KEY_SECRET
        if not secret or not signature:
            return False
        try:
            expected = hmac.HMAC(
                secret.encode("utf-8"),
                body,
                hashlib.sha256,
            ).hexdigest()
            return hmac.compare_digest(expected, signature)
        except Exception as exc:
            logger.error("Payment verification error: %s", exc)
            return False

    @staticmethod
    def extract_customer_details(
        link_entity: Optional[dict[str, Any]] = None,
        payment_entity: Optional[dict[str, Any]] = None,
    ) -> dict[str, str]:
        """Extract phone, name, email, and plan_tier from Razorpay payment_link and payment entities."""
        link_entity = link_entity or {}
        payment_entity = payment_entity or {}
        notes = link_entity.get("notes") if isinstance(link_entity.get("notes"), dict) else {}
        pay_notes = payment_entity.get("notes") if isinstance(payment_entity.get("notes"), dict) else {}
        customer = link_entity.get("customer") if isinstance(link_entity.get("customer"), dict) else {}
        cust_details = (
            payment_entity.get("customer_details")
            if isinstance(payment_entity.get("customer_details"), dict)
            else {}
        )

        raw_phone = (
            notes.get("phone_number")
            or pay_notes.get("phone_number")
            or customer.get("contact")
            or payment_entity.get("contact")
            or cust_details.get("contact")
            or ""
        )
        phone = normalize_phone(str(raw_phone)) if raw_phone else ""

        raw_email = (
            customer.get("email")
            or payment_entity.get("email")
            or cust_details.get("email")
            or notes.get("email")
            or ""
        ).strip()

        raw_name = (
            customer.get("name")
            or cust_details.get("name")
            or notes.get("name")
            or pay_notes.get("name")
            or ""
        ).strip()
        if not raw_name and raw_email and "@" in raw_email:
            local = raw_email.split("@", 1)[0].replace(".", " ").replace("_", " ").replace("-", " ").strip()
            if local and not local.isdigit():
                raw_name = local.title()[:64]

        plan_raw = str(notes.get("plan_tier") or pay_notes.get("plan_tier") or "pro").lower()
        plan_tier = "business" if plan_raw in ("business", "biz", "team") else "pro"

        return {
            "phone_number": phone,
            "name": raw_name[:128],
            "email": raw_email[:128],
            "plan_tier": plan_tier,
        }

    async def activate_premium(
        self,
        phone_number: str,
        plan_tier: str = "pro",
        name: Optional[str] = None,
    ) -> bool:
        """Set a user to premium status (Pro or Business) for 30 days, creating the User if needed."""
        phone_number = normalize_phone(phone_number)
        if not phone_number:
            return False
        clean_name = (name or "").strip()[:128] or None
        expires = datetime.utcnow() + timedelta(days=30)
        async with async_session() as session:
            result = await session.execute(
                select(User).where(User.phone_number == phone_number)
            )
            user = result.scalar_one_or_none()
            if user is None:
                user = User(
                    phone_number=phone_number,
                    name=clean_name,
                    is_premium=True,
                    plan_tier=plan_tier,
                    premium_expires_at=expires,
                )
                session.add(user)
                try:
                    await session.flush()
                except IntegrityError:
                    await session.rollback()
                    result = await session.execute(
                        select(User).where(User.phone_number == phone_number)
                    )
                    user = result.scalar_one_or_none()
                    if user is None:
                        return False

            user.is_premium = True
            user.plan_tier = plan_tier
            user.premium_expires_at = expires
            if clean_name and not user.name:
                user.name = clean_name

            if clean_name and user.id:
                onboarding = await session.get(UserOnboarding, user.id)
                if onboarding and not onboarding.name:
                    onboarding.name = clean_name

            await session.commit()
            logger.info("Premium (%s) activated for %s until %s", plan_tier, phone_number, user.premium_expires_at)
            return True

    async def complete_callback(self, params: dict[str, str]) -> dict[str, str]:
        """Verify Razorpay redirect callback parameters, fetch customer details, and activate premium."""
        plink_id = (params.get("razorpay_payment_link_id") or "").strip()
        payment_id = (params.get("razorpay_payment_id") or "").strip()
        ref_id = params.get("razorpay_payment_link_reference_id") or ""
        status = (params.get("razorpay_payment_link_status") or "").strip()
        signature = (params.get("razorpay_signature") or "").strip()

        link_entity: dict[str, Any] = {}
        payment_entity: dict[str, Any] = {}
        verified = False

        if self.client and plink_id:
            try:
                link_entity = await run_in_threadpool(self.client.payment_link.fetch, plink_id)
                if isinstance(link_entity, dict) and link_entity.get("status") == "paid":
                    verified = True
            except Exception as exc:
                logger.warning("Could not fetch Razorpay payment_link %s: %s", plink_id, exc)

        if self.client and payment_id:
            try:
                payment_entity = await run_in_threadpool(self.client.payment.fetch, payment_id)
                if isinstance(payment_entity, dict) and payment_entity.get("status") in ("captured", "authorized"):
                    verified = True
            except Exception as exc:
                logger.warning("Could not fetch Razorpay payment %s: %s", payment_id, exc)

        if not verified and plink_id and payment_id and signature and settings.RAZORPAY_KEY_SECRET:
            payload_str = f"{plink_id}|{ref_id}|{status}|{payment_id}"
            expected = hmac.HMAC(
                settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
                payload_str.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            if status == "paid" and hmac.compare_digest(expected, signature):
                verified = True

        details = self.extract_customer_details(link_entity, payment_entity)
        notes = link_entity.get("notes") if isinstance(link_entity.get("notes"), dict) else {}
        if verified and notes.get("product", PRODUCT_TAG) == PRODUCT_TAG and details["phone_number"]:
            await self.activate_premium(
                details["phone_number"],
                plan_tier=details["plan_tier"],
                name=details["name"] or None,
            )

        return details
