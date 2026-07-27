"""Usage tracking and rate-limiting service."""

import logging
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.models.database import async_session
from app.models.user import User, UserUsage

logger = logging.getLogger(__name__)
settings = get_settings()


class UsageService:
    """Track per-user daily query counts and enforce free/premium limits."""

    async def get_or_create_user(self, phone_number: str, name: str = "") -> User:
        """Fetch an existing user or create a new one."""
        async with async_session() as session:
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
                user.premium_expires_at = None
                await session.commit()
                await session.refresh(user)

            return user

    async def check_usage(
        self, phone_number: str
    ) -> dict:
        """Check whether the user can send another message today.

        Returns:
            {"allowed": bool, "remaining": int, "is_premium": bool}
        """
        user = await self.get_or_create_user(phone_number)
        limit = (
            settings.PAID_DAILY_LIMIT if user.is_premium else settings.FREE_DAILY_LIMIT
        )

        async with async_session() as session:
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
        }

    async def increment_usage(self, phone_number: str) -> None:
        """Increment today's query count for the given phone number."""
        user = await self.get_or_create_user(phone_number)

        async with async_session() as session:
            result = await session.execute(
                select(UserUsage).where(
                    UserUsage.user_id == user.id,
                    UserUsage.date == date.today(),
                )
            )
            usage = result.scalar_one_or_none()

            if usage is None:
                usage = UserUsage(
                    user_id=user.id,
                    date=date.today(),
                    query_count=1,
                )
                session.add(usage)
            else:
                usage.query_count += 1

            await session.commit()
