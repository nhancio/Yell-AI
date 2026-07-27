"""Razorpay payment webhook and status endpoints."""

import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from app.services.payment import PaymentService
from app.services.whatsapp import WhatsAppService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payment", tags=["payment"])

payment_service = PaymentService()
whatsapp = WhatsAppService()

@router.get("/success", response_class=HTMLResponse)
async def payment_success():
    """Show a success message when the user returns from Razorpay."""
    return """
    <html>
        <head>
            <title>Payment Successful - Yell AI</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: -apple-system, sans-serif; text-align: center; padding: 40px 20px; background: #0A0A0A; color: #fff; }
                h1 { color: #facc15; }
                p { color: #a1a1aa; }
            </style>
        </head>
        <body>
            <h1>Payment Successful! 🎉</h1>
            <p>Your Yell AI Pro subscription is now active.</p>
            <p>You can close this window and return to WhatsApp.</p>
        </body>
    </html>
    """


@router.post("/webhook")
async def razorpay_webhook(request: Request) -> dict:
    """Handle Razorpay payment webhook events."""
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if not payment_service.verify_payment("", signature, body):
        logger.warning("Invalid Razorpay webhook signature")
        return {"status": "invalid_signature"}

    try:
        payload = json.loads(body)
        event = payload.get("event", "")

        if event == "payment_link.paid":
            payment_entity = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
            notes = payment_entity.get("notes", {})
            phone_number = notes.get("phone_number", "")

            if phone_number:
                success = await payment_service.activate_premium(phone_number)
                if success:
                    await whatsapp.send_message(
                        phone_number,
                        "🎉 *Welcome to Yell AI Pro!*\n\n"
                        "You now have 1000 conversations/day for the next 30 days.\n\n"
                        "Go ahead, yell away! I'm all ears. 💛"
                    )
                    logger.info("Premium activated via webhook for %s", phone_number)

        return {"status": "ok"}

    except Exception as exc:
        logger.error("Razorpay webhook error: %s", exc, exc_info=True)
        return {"status": "error"}


@router.get("/status/{phone_number}")
async def payment_status(phone_number: str) -> dict:
    """Check premium status for a phone number."""
    from app.services.usage import UsageService

    usage_service = UsageService()
    user = await usage_service.get_or_create_user(phone_number)

    return {
        "phone_number": phone_number,
        "is_premium": user.is_premium,
        "premium_expires_at": (
            user.premium_expires_at.isoformat() if user.premium_expires_at else None
        ),
    }
