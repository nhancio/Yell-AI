"""Razorpay payment webhook and status endpoints."""

import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse

from pydantic import BaseModel
from fastapi import HTTPException
from app.config import get_settings
from app.services.payment import PaymentService
from app.services.usage import UsageService
from app.services.auth import current_phone
from app.services.composio_service import normalize_phone
from typing import Literal

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/payment", tags=["payment"])

payment_service = PaymentService()
usage_service = UsageService()


class PublicPaymentLinkRequest(BaseModel):
    phone_number: str
    plan: Literal["pro", "business"] = "pro"


@router.post("/create-link")
async def create_public_payment_link(req: PublicPaymentLinkRequest, owner: str = Depends(current_phone)) -> dict:
    """Create a Razorpay payment link for Pro (₹99) or Business (₹999)."""
    norm_phone = normalize_phone(req.phone_number)
    if norm_phone != owner:
        raise HTTPException(status_code=403, detail="Payment must belong to the logged-in account")
    user = await usage_service.get_or_create_user(norm_phone)
    url = await payment_service.create_payment_link(f"+{norm_phone}", user.id, plan=req.plan)
    if not url:
        raise HTTPException(status_code=503, detail="Razorpay payment initiation failed")
    is_biz = req.plan.lower() in ("business", "biz", "team")
    amount = getattr(settings, "BUSINESS_PRICE_PAISE", 99900) // 100 if is_biz else settings.MONTHLY_PRICE_PAISE // 100
    return {
        "payment_url": url,
        "amount_inr": amount,
        "plan": "business" if is_biz else "pro",
        "phone_number": norm_phone
    }

@router.get("/success", response_class=HTMLResponse)
async def payment_success():
    """Show a success message when the user returns from Razorpay."""
    return """
    <html>
        <head>
            <title>Payment Successful - Astra AI</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: -apple-system, sans-serif; text-align: center; padding: 40px 20px; background: #0A0A0A; color: #fff; }
                h1 { color: #facc15; }
                p { color: #a1a1aa; }
            </style>
        </head>
        <body>
            <h1>Payment Successful! 🎉</h1>
            <p>Your Astra AI Pro subscription is now active.</p>
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
        raise HTTPException(status_code=401, detail="Invalid payment signature")

    try:
        payload = json.loads(body)
        event = payload.get("event", "")

        if event == "payment_link.paid":
            payment_entity = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
            notes = payment_entity.get("notes", {})
            phone_number = notes.get("phone_number", "")

            if phone_number:
                plan_tier = notes.get("plan_tier", "pro")
                success = await payment_service.activate_premium(phone_number, plan_tier=plan_tier)
                # No WhatsApp confirmation: the bot only replies, it never messages first.
                if success:
                    logger.info("Premium (%s) activated via webhook for %s", plan_tier, phone_number)

        return {"status": "ok"}

    except Exception as exc:
        logger.error("Razorpay webhook error: %s", exc, exc_info=True)
        return {"status": "error"}


@router.get("/status/{phone_number}")
async def payment_status(phone_number: str, owner: str = Depends(current_phone)) -> dict:
    """Check premium status for a phone number."""
    phone_number = normalize_phone(phone_number)
    if phone_number != owner:
        raise HTTPException(status_code=403, detail="Payment belongs to another account")
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
