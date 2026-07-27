"""Health check and admin stats endpoints."""

from datetime import date

from fastapi import APIRouter
from sqlalchemy import func, select

from app.models.database import async_session
from app.models.user import Conversation, User, UserUsage

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    return {"status": "healthy", "service": "Yell AI", "version": "1.0.0"}


@router.get("/stats")
async def stats() -> dict:
    """Basic admin stats — protect this in production."""
    async with async_session() as session:
        user_count = await session.scalar(select(func.count(User.id)))
        today_queries = await session.scalar(
            select(func.sum(UserUsage.query_count)).where(
                UserUsage.date == date.today()
            )
        )
        total_messages = await session.scalar(select(func.count(Conversation.id)))
        premium_users = await session.scalar(
            select(func.count(User.id)).where(User.is_premium.is_(True))
        )

    return {
        "total_users": user_count or 0,
        "today_queries": today_queries or 0,
        "total_messages": total_messages or 0,
        "premium_users": premium_users or 0,
    }
