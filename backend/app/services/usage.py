"""Usage tracking and rate-limiting service."""

import logging
from datetime import date, datetime, timedelta
from contextlib import nullcontext

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.database import async_session, ensure_tables
from app.models.onboarding import UserOnboarding
from app.models.user import User, UserUsage, VerifiedWhatsAppAccount

logger = logging.getLogger(__name__)
settings = get_settings()


class UsageService:
    """Track per-user daily query counts and enforce free/premium limits."""

    async def get_or_create_user(self, phone_number: str, name: str = "", *, session: AsyncSession | None = None) -> User:
        """Fetch an existing user or create a new one."""
        if session is None:
            await ensure_tables()
        async with (nullcontext(session) if session is not None else async_session()) as session:
            result = await session.execute(
                select(User).where(User.phone_number == phone_number)
            )
            user = result.scalar_one_or_none()

            if user is None:
                user = User(phone_number=phone_number, name=name or None)
                session.add(user)
                try:
                    await session.commit()
                    await session.refresh(user)
                except IntegrityError:
                    await session.rollback()
                    result = await session.execute(
                        select(User).where(User.phone_number == phone_number)
                    )
                    user = result.scalar_one()

            # Check if premium has expired
            if (
                user.is_premium
                and user.premium_expires_at
                and user.premium_expires_at < datetime.utcnow()
            ):
                user.is_premium = False
                user.plan_tier = "free"
                user.premium_expires_at = None
                await session.commit()
                await session.refresh(user)

            return user

    async def signup_state(self, phone_number: str) -> tuple[bool, int]:
        """(signed_up, preview replies left). Signed up = logged in to the app (same number, OTP) or paid."""
        await ensure_tables()
        async with async_session() as session:
            user = await self.get_or_create_user(phone_number, session=session)
            if (user.is_premium or await session.get(UserOnboarding, user.id)
                    or await session.get(VerifiedWhatsAppAccount, user.phone_number)):
                return True, 0
            used = await session.scalar(
                select(func.coalesce(func.sum(UserUsage.query_count), 0)).where(UserUsage.user_id == user.id)
            )
        return False, max(0, settings.SIGNUP_PREVIEW_MESSAGES - used)

    async def check_usage(
        self, phone_number: str
    ) -> dict:
        """Check whether the user can send another message today against their tier limit.

        Returns:
            {"allowed": bool, "remaining": int, "is_premium": bool, "plan_tier": str, "limit": int}
        """
        await ensure_tables()
        async with async_session() as session:
            user = await self.get_or_create_user(phone_number, session=session)
            tier = ("business" if user.plan_tier == "business" else "pro") if user.is_premium else "free"
            if tier == "business":
                limit = settings.BUSINESS_DAILY_LIMIT
            elif tier == "pro" or user.is_premium:
                limit = settings.PAID_DAILY_LIMIT
            else:
                limit = settings.FREE_DAILY_LIMIT

            result = await session.execute(
                select(UserUsage).where(
                    UserUsage.user_id == user.id,
                    UserUsage.date == date.today(),
                )
            )
            usage = result.scalar_one_or_none()
            current_count = usage.query_count if usage else 0

        remaining = max(0, limit - current_count)
        return {
            "allowed": current_count < limit,
            "remaining": remaining,
            "is_premium": user.is_premium,
            "plan_tier": tier,
            "limit": limit,
        }

    async def increment_usage(self, phone_number: str) -> None:
        """Atomically increment today's query count for the given phone number."""
        await ensure_tables()
        today = date.today()
        async with async_session() as session:
            user = await self.get_or_create_user(phone_number, session=session)
            dialect = session.bind.dialect.name if session.bind else ""
            if dialect in ("sqlite", "postgresql"):
                ins = sqlite_insert if dialect == "sqlite" else pg_insert
                stmt = ins(UserUsage).values(user_id=user.id, date=today, query_count=1)
                stmt = stmt.on_conflict_do_update(
                    index_elements=[UserUsage.user_id, UserUsage.date],
                    set_={"query_count": UserUsage.query_count + 1},
                )
                await session.execute(stmt)
                await session.commit()
                return

            updated = await session.execute(
                update(UserUsage)
                .where(UserUsage.user_id == user.id, UserUsage.date == today)
                .values(query_count=UserUsage.query_count + 1)
            )
            if updated.rowcount == 0:
                session.add(UserUsage(user_id=user.id, date=today, query_count=1))
            await session.commit()
