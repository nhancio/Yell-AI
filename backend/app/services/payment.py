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

logger = logging.getLogger(__name__)
settings = get_settings()


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
        self, phone_number: str, user_id: int
    ) -> Optional[str]:
        """Create a Razorpay payment link and return the short URL.

        Returns None if Razorpay is not configured or link creation fails.
        """
        if not self.client:
            logger.error("Razorpay client not initialised")
            return None

        try:
            data = {
                "amount": settings.MONTHLY_PRICE_PAISE,
                "currency": "INR",
                "description": "Yell AI Premium - 30 Days",
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
                    "phone_number": phone_number,
                    "user_id": str(user_id),
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
        try:
            expected = hmac.HMAC(
                settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
                body,
                hashlib.sha256,
            ).hexdigest()
            return hmac.compare_digest(expected, signature)
        except Exception as exc:
            logger.error("Payment verification error: %s", exc)
            return False

    async def activate_premium(self, phone_number: str) -> bool:
        """Set a user to premium status for 30 days.

        Returns True on success, False if user not found.
        """
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
            user.premium_expires_at = datetime.utcnow() + timedelta(days=30)
            await session.commit()
            logger.info("Premium activated for %s until %s", phone_number, user.premium_expires_at)
            return True
