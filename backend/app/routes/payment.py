"""Razorpay payment webhook and status endpoints."""

import json
import logging
from typing import Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

from app.config import get_settings
from app.services.auth import current_phone
from app.services.composio_service import normalize_phone
from app.services.payment import PRODUCT_TAG, PaymentService
from app.services.usage import UsageService

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
    """Create a Razorpay payment link for Pro or Business (prices from settings)."""
    norm_phone = normalize_phone(req.phone_number)
    if norm_phone != owner:
        raise HTTPException(status_code=403, detail="Payment must belong to the logged-in account")
    user = await usage_service.get_or_create_user(norm_phone)
    url = await payment_service.create_payment_link(f"+{norm_phone}", user.id, plan=req.plan)
    if not url:
        raise HTTPException(status_code=503, detail="Razorpay payment initiation failed")
    is_biz = req.plan.lower() in ("business", "biz", "team")
    amount = settings.BUSINESS_PRICE_PAISE // 100 if is_biz else settings.MONTHLY_PRICE_PAISE // 100
    return {
        "payment_url": url,
        "amount_inr": amount,
        "plan": "business" if is_biz else "pro",
        "phone_number": norm_phone
    }

@router.get("/checkout")
async def direct_checkout(plan: Literal["pro", "business"] = "pro", phone: str = "") -> RedirectResponse:
    """Redirect directly to Razorpay checkout without an intermediate screen."""
    norm_phone = normalize_phone(phone) if phone else ""
    url = await payment_service.create_payment_link(
        f"+{norm_phone}" if norm_phone else "",
        user_id=None,
        plan=plan,
    )
    if not url:
        raise HTTPException(status_code=503, detail="Razorpay payment initiation failed")
    return RedirectResponse(
        url=url,
        status_code=302,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.get("/success")
async def payment_success(request: Request) -> RedirectResponse:
    """Capture user details from Razorpay callback, activate subscription, and send to login."""
    details = await payment_service.complete_callback(dict(request.query_params))
    query: dict[str, str] = {
        "paid": "1",
        "plan": details.get("plan_tier") or "pro",
    }
    if details.get("phone_number"):
        query["phone"] = details["phone_number"]
    if details.get("name"):
        query["name"] = details["name"]
    if details.get("email"):
        query["email"] = details["email"]
    return RedirectResponse(
        url=f"/app?{urlencode(query)}",
        status_code=302,
        headers={"Cache-Control": "no-store"},
    )


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
            pl_payload = payload.get("payload", {})
            payment_link_entity = pl_payload.get("payment_link", {}).get("entity", {})
            payment_entity = pl_payload.get("payment", {}).get("entity", {})
            notes = payment_link_entity.get("notes", {})
            if notes.get("product") != PRODUCT_TAG:
                logger.info("Ignoring payment_link.paid for another product")
                return {"status": "ignored"}

            details = payment_service.extract_customer_details(payment_link_entity, payment_entity)
            phone_number = details["phone_number"]
            if phone_number:
                plan_tier = details["plan_tier"]
                kwargs = {"plan_tier": plan_tier}
                if details.get("name"):
                    kwargs["name"] = details["name"]
                success = await payment_service.activate_premium(phone_number, **kwargs)
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
