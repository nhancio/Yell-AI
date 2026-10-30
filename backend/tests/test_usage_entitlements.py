"""A stale or expired plan label must never grant a paid usage allowance."""

from contextlib import ExitStack
from datetime import date, datetime, timedelta
import unittest
from unittest.mock import AsyncMock, patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.database import Base
from app.models.user import User, UserUsage
from app.services import usage

PHONE = "919876543210"


class EntitlementTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(usage, "async_session", self.sessions))
        self.stack.enter_context(patch.object(usage, "ensure_tables", AsyncMock()))

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def seed(self, tier, premium, expires=None):
        async with self.sessions() as db:
            user = User(phone_number=PHONE, plan_tier=tier, is_premium=premium, premium_expires_at=expires)
            db.add(user)
            await db.flush()
            db.add(UserUsage(user_id=user.id, date=date.today(), query_count=usage.settings.FREE_DAILY_LIMIT))
            await db.commit()

    async def test_unpaid_account_cannot_use_a_stale_business_allowance(self):
        await self.seed("business", False)
        result = await usage.UsageService().check_usage(PHONE)
        self.assertEqual(result["plan_tier"], "free")
        self.assertEqual(result["limit"], usage.settings.FREE_DAILY_LIMIT)
        self.assertFalse(result["allowed"])

    async def test_expired_subscription_reverts_to_free_and_stays_there(self):
        await self.seed("pro", True, datetime.now() - timedelta(days=1))
        for _ in range(2):
            result = await usage.UsageService().check_usage(PHONE)
            self.assertEqual(result["plan_tier"], "free")
            self.assertFalse(result["allowed"])
        async with self.sessions() as db:
            user = await db.scalar(select(User).where(User.phone_number == PHONE))
            self.assertFalse(user.is_premium)
            self.assertEqual(user.plan_tier, "free")

    async def test_active_paid_subscription_keeps_its_allowance(self):
        await self.seed("business", True, datetime.now() + timedelta(days=1))
        result = await usage.UsageService().check_usage(PHONE)
        self.assertEqual(result["plan_tier"], "business")
        self.assertEqual(result["limit"], usage.settings.BUSINESS_DAILY_LIMIT)
        self.assertTrue(result["allowed"])
