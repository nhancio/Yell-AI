"""Authenticated Yell App endpoints (phone-verified via Firebase)."""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.config import get_settings
from app.models.database import async_session
from app.models.user import UserUsage
from app.services.auth import current_phone
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
    limit = settings.PAID_DAILY_LIMIT if user.is_premium else settings.FREE_DAILY_LIMIT
    connections = await composio.get_user_connections(phone)
    return {
        "phone_number": phone,
        "name": user.name,
        "member_since": user.created_at.isoformat() if user.created_at else None,
        "plan": {
            "is_premium": user.is_premium,
            "name": "Pro" if user.is_premium else "Free",
            "expires_at": user.premium_expires_at.isoformat() if user.premium_expires_at else None,
            "price_inr": settings.MONTHLY_PRICE_PAISE // 100,
        },
        "usage": {"used_today": used, "daily_limit": limit},
        "whatsapp_number": settings.WHATSAPP_DISPLAY_NUMBER,
        "connections": connections,
    }


@router.post("/connectors/link")
async def link_connector(body: ToolkitBody, phone: str = Depends(current_phone)) -> dict[str, Any]:
    """Create a Composio OAuth link for the logged-in user's own number."""
    try:
        return await composio.create_auth_link(
            phone_number=phone,
            toolkit=body.toolkit,
            redirect_url=f"{settings.APP_FRONTEND_URL}/?connected={body.toolkit}",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/upgrade")
async def upgrade(phone: str = Depends(current_phone)) -> dict[str, Any]:
    """Create a Razorpay payment link for Yell Pro."""
    user = await usage_service.get_or_create_user(phone)
    url = await payment_service.create_payment_link(f"+{phone}", user.id)
    if not url:
        raise HTTPException(status_code=503, detail="Payments unavailable right now")
    return {"payment_url": url}
