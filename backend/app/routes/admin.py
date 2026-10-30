"""Admin routes for dashboarding and flow monitoring."""

import hmac
import logging
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Query, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from sqlalchemy import func, select, desc

from app.models.database import async_session
from app.models.user import FlowLog, User, Conversation, UserUsage
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

api_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=True)

async def verify_admin_key(api_key: str = Security(api_key_header)):
    """Verify the admin API key. Refuses everything until a real ADMIN_API_KEY is configured."""
    configured = settings.ADMIN_API_KEY
    # The old hard-coded default is public in git history, so it never counts as configured
    if len(configured) < 32 or configured == "supersecretadmin123" or not hmac.compare_digest(api_key.encode(), configured.encode()):
        logger.warning("Rejected admin API request with invalid key")
        raise HTTPException(status_code=403, detail="Forbidden: Invalid Admin Key")
    return api_key

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(verify_admin_key)])


@router.get("/stats")
async def get_admin_stats() -> dict:
    """Consolidated stats for the dashboard."""
    async with async_session() as session:
        # Total users
        user_count = await session.scalar(select(func.count(User.id)))
        
        # Today's queries
        today_queries = await session.scalar(
            select(func.sum(UserUsage.query_count)).where(
                UserUsage.date == date.today()
            )
        )
        
        # Success vs Error in last 24h
        last_24h = datetime.utcnow() - timedelta(hours=24)
        success_count = await session.scalar(
            select(func.count(FlowLog.id)).where(FlowLog.status == "success", FlowLog.created_at >= last_24h)
        )
        error_count = await session.scalar(
            select(func.count(FlowLog.id)).where(FlowLog.status == "error", FlowLog.created_at >= last_24h)
        )
        
        # Premium users
        premium_count = await session.scalar(
            select(func.count(User.id)).where(User.is_premium.is_(True))
        )

    return {
        "total_users": user_count or 0,
        "today_queries": today_queries or 0,
        "success_rate_24h": success_count or 0,
        "error_rate_24h": error_count or 0,
        "premium_users": premium_count or 0,
    }


@router.get("/flows")
async def get_flows(limit: int = 50, offset: int = 0) -> list[dict]:
    """Recent webhook and message logs."""
    async with async_session() as session:
        result = await session.execute(
            select(FlowLog).order_by(desc(FlowLog.created_at)).limit(limit).offset(offset)
        )
        logs = result.scalars().all()
        
    return [
        {
            "id": log.id,
            "direction": log.direction,
            "sender": log.sender,
            "status": log.status,
            "payload": log.payload[:500] + "..." if log.payload and len(log.payload) > 500 else log.payload,
            "error_message": log.error_message,
            "created_at": log.created_at,
        }
        for log in logs
    ]
