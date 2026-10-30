"""Checkout and paid-webhook phone formats must identify the same account."""

import unittest
from unittest.mock import MagicMock, patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.database import Base
from app.models.user import User
from app.services import payment

PHONE = "919876543210"


class PaymentIdentityTests(unittest.IsolatedAsyncioTestCase):
    async def test_checkout_keeps_customer_contact_but_stores_canonical_account_phone(self):
        service = payment.PaymentService()
        service.client = MagicMock()
        service.client.payment_link.create.return_value = {"short_url": "https://example.test/pay"}
        self.assertEqual(await service.create_payment_link("+" + PHONE, 123, "business"), "https://example.test/pay")
        payload = service.client.payment_link.create.call_args.args[0]
        self.assertEqual(payload["customer"]["contact"], "+" + PHONE)
        self.assertEqual(payload["notes"]["phone_number"], PHONE)
        self.assertEqual(payload["notes"]["plan_tier"], "business")

    async def test_legacy_payment_notes_with_plus_activate_the_existing_account(self):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            async with sessions() as session:
                session.add(User(phone_number=PHONE))
                await session.commit()
            with patch.object(payment, "async_session", sessions):
                self.assertTrue(await payment.PaymentService().activate_premium("+" + PHONE, "business"))
            async with sessions() as session:
                user = await session.scalar(select(User).where(User.phone_number == PHONE))
                self.assertTrue(user.is_premium)
                self.assertEqual(user.plan_tier, "business")
        finally:
            await engine.dispose()
