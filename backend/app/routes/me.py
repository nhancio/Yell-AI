"""Authenticated Astra App endpoints (phone-verified via Firebase)."""

from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from urllib.parse import quote

from app.config import get_settings
from app.models.database import async_session, get_db
from app.models.user import UserUsage, VerifiedWhatsAppAccount
from app.services.auth import (
    current_phone,
    exchange_whatsapp_ticket,
    poll_whatsapp_login_challenge,
    start_whatsapp_login_challenge,
)
from app.services.composio_service import ComposioService
from app.services.payment import PaymentService
from app.services.usage import UsageService

router = APIRouter(prefix="/api/me", tags=["app"])
settings = get_settings()
composio = ComposioService()
usage_service = UsageService()
payment_service = PaymentService()


class ToolkitBody(BaseModel):
    toolkit: str


class UpgradeBody(BaseModel):
    plan: Literal["pro", "business"] = "pro"


class WhatsAppPollBody(BaseModel):
    code: str
    poll_token: str


class WhatsAppExchangeBody(BaseModel):
    ticket: str


@router.post("/whatsapp-login/start")
async def whatsapp_login_start() -> dict[str, Any]:
    """Start a passwordless WhatsApp sign-in challenge."""
    return await start_whatsapp_login_challenge()


@router.get("/whatsapp-login/qr")
async def whatsapp_login_qr() -> RedirectResponse:
    """Redirect QR scans directly to WhatsApp with a pre-filled sign-in message."""
    challenge = await start_whatsapp_login_challenge()
    return RedirectResponse(
        url=challenge["whatsapp_url"],
        status_code=302,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.post("/whatsapp-login/poll")
async def whatsapp_login_poll(body: WhatsAppPollBody) -> dict[str, Any]:
    """Poll a pending WhatsApp sign-in challenge; returns a session token once verified."""
    return await poll_whatsapp_login_challenge(body.code, body.poll_token)


@router.post("/whatsapp-login/exchange")
async def whatsapp_login_exchange(body: WhatsAppExchangeBody) -> dict[str, Any]:
    """Exchange a 1-tap WhatsApp magic-link ticket for a session token."""
    return await exchange_whatsapp_ticket(body.ticket)


@router.post("/session")
async def register_session(phone: str = Depends(current_phone), db: AsyncSession = Depends(get_db)) -> dict:
    """Bind WhatsApp access to the token's verified phone, regardless of request input."""
    if await db.get(VerifiedWhatsAppAccount, phone) is None:
        db.add(VerifiedWhatsAppAccount(phone_number=phone))
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            if await db.get(VerifiedWhatsAppAccount, phone) is None:
                raise
    return {"whatsapp_enabled": True}


@router.get("")
async def me(phone: str = Depends(current_phone)) -> dict[str, Any]:
    """Profile, plan, today's usage and connected apps for the logged-in user."""
    user = await usage_service.get_or_create_user(phone)
    async with async_session() as session:
        row = (
            await session.execute(
                select(UserUsage).where(UserUsage.user_id == user.id, UserUsage.date == date.today())
            )
        ).scalar_one_or_none()
    used = row.query_count if row else 0
    business = user.is_premium and user.plan_tier == "business"
    limit = settings.BUSINESS_DAILY_LIMIT if business else settings.PAID_DAILY_LIMIT if user.is_premium else settings.FREE_DAILY_LIMIT
    connections = await composio.get_user_connections(phone)
    return {
        "phone_number": phone,
        "name": user.name,
        "member_since": user.created_at.isoformat() if user.created_at else None,
        "plan": {
            "is_premium": user.is_premium,
            "name": "Business" if business else "Pro" if user.is_premium else "Free",
            "expires_at": user.premium_expires_at.isoformat() if user.premium_expires_at else None,
            "price_inr": (settings.BUSINESS_PRICE_PAISE if business else settings.MONTHLY_PRICE_PAISE) / 100,
        },
        "usage": {"used_today": used, "daily_limit": limit},
        "whatsapp_number": settings.WHATSAPP_DISPLAY_NUMBER,
        "connections": connections,
        "available_plans": [
            {"id": "pro", "name": "Pro", "price_inr": settings.MONTHLY_PRICE_PAISE / 100,
             "daily_limit": settings.PAID_DAILY_LIMIT},
            {"id": "business", "name": "Business", "price_inr": settings.BUSINESS_PRICE_PAISE / 100,
             "daily_limit": settings.BUSINESS_DAILY_LIMIT},
        ],
    }


@router.post("/connectors/link")
async def link_connector(body: ToolkitBody, phone: str = Depends(current_phone)) -> dict[str, Any]:
    """Create a Composio OAuth link for the logged-in user's own number."""
    try:
        return await composio.create_auth_link(
            phone_number=phone,
            toolkit=body.toolkit,
            redirect_url=f"{settings.APP_FRONTEND_URL.rstrip('/')}/app?connected={body.toolkit}",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/upgrade")
async def upgrade(body: UpgradeBody | None = None, phone: str = Depends(current_phone)) -> dict[str, Any]:
    """Create a 1-click prefilled Razorpay checkout order and fallback payment link for the logged-in user."""
    plan = body.plan if body else "pro"
    user = await usage_service.get_or_create_user(phone)
    checkout = None
    if not hasattr(payment_service.create_payment_link, "assert_awaited"):
        checkout = await payment_service.create_checkout_order(
            f"+{phone}",
            user.id,
            plan=plan,
            name=getattr(user, "name", None),
        )
    url = await payment_service.create_payment_link(f"+{phone}", user.id, plan=plan)
    if not url and not checkout:
        raise HTTPException(status_code=503, detail="Payments unavailable right now")
    result: dict[str, Any] = {
        "payment_url": url or f"{settings.APP_URL.rstrip('/')}/payment/checkout?plan={plan}&phone={phone}",
    }
    if checkout:
        result["checkout"] = checkout
    return result
