"""Health check and admin stats endpoints."""

from datetime import date
import asyncio

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text

from app.models.database import async_session, engine
from app.models.user import Conversation, User, UserUsage
from app.routes.admin import verify_admin_key
from app.services.memory import memory_service

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    return {"status": "healthy", "service": "Astra AI", "version": "1.0.0"}


@router.get("/ready")
async def readiness():
    checks = {"database": "unavailable", "memory": "unavailable"}
    try:
        async with asyncio.timeout(5):
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        pass
    if await memory_service.ping():
        checks["memory"] = "ok"
    ready = all(value == "ok" for value in checks.values())
    return JSONResponse(status_code=200 if ready else 503,
                        content={"status": "ready" if ready else "not_ready", "checks": checks})


@router.get("/stats", dependencies=[Depends(verify_admin_key)])
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
