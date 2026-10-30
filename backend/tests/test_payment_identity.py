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

    async def test_direct_razorpay_payment_creates_and_upgrades_user_from_razorpay_customer_details(self):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            svc = payment.PaymentService()
            svc.client = MagicMock()
            svc.client.payment_link.create.return_value = {"short_url": "https://rzp.io/i/direct"}
            # 1. Direct checkout without phone omits customer block so Razorpay collects contact
            url = await svc.create_payment_link("", None, "pro")
            self.assertEqual(url, "https://rzp.io/i/direct")
            create_payload = svc.client.payment_link.create.call_args.args[0]
            self.assertNotIn("customer", create_payload)
            self.assertEqual(create_payload["notes"]["product"], payment.PRODUCT_TAG)
            self.assertEqual(create_payload["notes"]["plan_tier"], "pro")

            # 2. Callback fetches customer contact & name from Razorpay and creates/activates user before login
            svc.client.payment_link.fetch.return_value = {
                "status": "paid",
                "notes": {"product": payment.PRODUCT_TAG, "plan_tier": "business"},
                "customer": {"contact": "+91 98765-43210", "name": "Aarav Sharma", "email": "aarav@example.com"},
            }
            with patch.object(payment, "async_session", sessions), \
                 patch.object(payment, "ensure_tables", MagicMock(return_value=None)):
                # make ensure_tables awaitable
                async def _noop():
                    return None
                with patch.object(payment, "ensure_tables", _noop):
                    details = await svc.complete_callback({"razorpay_payment_link_id": "plink_123"})
            self.assertEqual(details["phone_number"], PHONE)
            self.assertEqual(details["name"], "Aarav Sharma")
            self.assertEqual(details["email"], "aarav@example.com")
            self.assertEqual(details["plan_tier"], "business")
            async with sessions() as session:
                user = await session.scalar(select(User).where(User.phone_number == PHONE))
                self.assertIsNotNone(user)
                self.assertTrue(user.is_premium)
                self.assertEqual(user.plan_tier, "business")
                self.assertEqual(user.name, "Aarav Sharma")
        finally:
            await engine.dispose()

