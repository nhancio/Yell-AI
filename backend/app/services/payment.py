"""Razorpay payment integration for premium subscriptions."""

import hashlib
import hmac
import logging
from datetime import datetime, timedelta
from typing import Optional

import razorpay
from sqlalchemy import select

from app.config import get_settings
from app.models.database import async_session
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
        self, phone_number: str, user_id: int, plan: str = "pro"
    ) -> Optional[str]:
        """Create a Razorpay payment link for Pro (₹99) or Business (₹999) and return the short URL."""
        if not self.client:
            logger.error("Razorpay client not initialised")
            return None

        is_biz = plan.lower() in ("business", "biz", "team")
        amount = getattr(settings, "BUSINESS_PRICE_PAISE", 99900) if is_biz else settings.MONTHLY_PRICE_PAISE
        desc = "Astra AI Business (1,000 tasks/day) - 30 Days" if is_biz else "Astra AI Pro (80 tasks/day FUP) - 30 Days"

        try:
            data = {
                "amount": amount,
                "currency": "INR",
                "description": desc,
                "customer": {
                    "contact": phone_number,
                },
                "notify": {
                    "sms": True,
                    "email": False,
                    "whatsapp": False,
                },
                "callback_url": f"{settings.APP_URL}/payment/success",
                "callback_method": "get",
                "notes": {
                    # The Razorpay account is shared with other products; the webhook only
                    # grants Astra plans for links carrying this marker.
                    "product": PRODUCT_TAG,
                    "phone_number": normalize_phone(phone_number),
                    "user_id": str(user_id),
                    "plan_tier": "business" if is_biz else "pro",
                },
            }
            link = self.client.payment_link.create(data)
            short_url = link.get("short_url", "")
            logger.info(
                "Created payment link for %s: %s", phone_number, short_url
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

    async def activate_premium(self, phone_number: str, plan_tier: str = "pro") -> bool:
        """Set a user to premium status (Pro or Business) for 30 days."""
        phone_number = normalize_phone(phone_number)
        async with async_session() as session:
            result = await session.execute(
                select(User).where(User.phone_number == phone_number)
            )
            user = result.scalar_one_or_none()
            if user is None:
                logger.warning(
                    "activate_premium: user not found for %s", phone_number
                )
                return False

            user.is_premium = True
            user.plan_tier = plan_tier
            user.premium_expires_at = datetime.utcnow() + timedelta(days=30)
            await session.commit()
            logger.info("Premium (%s) activated for %s until %s", plan_tier, phone_number, user.premium_expires_at)
            return True
