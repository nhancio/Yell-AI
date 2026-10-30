"""Authenticated onboarding state and configured plan contracts."""

import unittest
from unittest.mock import AsyncMock, patch

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.main import app
from app.models.database import Base, get_db
from app.models.user import User
from app.routes import me
from app.services.auth import current_phone

PHONE, OTHER = "919876543210", "919876543211"


class OnboardingTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with self.sessions() as session:
            session.add_all([User(phone_number=PHONE, name="Nithin"), User(phone_number=OTHER)])
            await session.commit()

        async def db():
            async with self.sessions() as session:
                yield session

        self.previous_overrides = app.dependency_overrides.copy()
        app.dependency_overrides[get_db] = db
        app.dependency_overrides[current_phone] = lambda: PHONE
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self.previous_overrides)
        await self.client.aclose()
        await self.engine.dispose()

    async def test_login_is_required(self):
        del app.dependency_overrides[current_phone]
        for method in ("GET", "PATCH"):
            response = await self.client.request(method, "/api/me/onboarding", json={})
            self.assertEqual(response.status_code, 401)

    async def test_defaults_then_preferences_survive_a_new_request(self):
        initial = await self.client.get("/api/me/onboarding")
        self.assertEqual(initial.status_code, 200)
        self.assertEqual(initial.json()["step"], "name")
        self.assertFalse(initial.json()["completed"])
        response = await self.client.patch("/api/me/onboarding", json={
            "name": "  Nithi  ", "interests": ["email", "research", "email"], "step": "apps"})
        self.assertEqual(response.status_code, 200)
        saved = (await self.client.get("/api/me/onboarding")).json()
        self.assertEqual(saved["name"], "Nithi")
        self.assertEqual(saved["interests"], ["email", "research"])
        self.assertEqual(saved["step"], "apps")
        async with self.sessions() as session:
            user = await session.scalar(select(User).where(User.phone_number == PHONE))
            self.assertEqual(user.name, "Nithi")

    async def test_first_login_creates_a_profile_using_the_request_session(self):
        app.dependency_overrides[current_phone] = lambda: "919876543299"
        response = await self.client.patch("/api/me/onboarding", json={
            "name": "New owner", "interests": ["calendar"], "step": "apps"})
        self.assertEqual(response.status_code, 200)
        saved = (await self.client.get("/api/me/onboarding")).json()
        self.assertEqual(saved["name"], "New owner")
        self.assertEqual(saved["interests"], ["calendar"])
        self.assertEqual(saved["step"], "apps")

    async def test_another_user_cannot_read_or_change_saved_preferences(self):
        await self.client.patch("/api/me/onboarding", json={"name": "Owner", "interests": ["email"]})
        app.dependency_overrides[current_phone] = lambda: OTHER
        other = (await self.client.get("/api/me/onboarding")).json()
        self.assertEqual(other["interests"], [])
        self.assertNotEqual(other["name"], "Owner")
        response = await self.client.patch("/api/me/onboarding", json={"phone_number": PHONE, "name": "Attacker"})
        self.assertEqual(response.status_code, 422)
        app.dependency_overrides[current_phone] = lambda: PHONE
        self.assertEqual((await self.client.get("/api/me/onboarding")).json()["name"], "Owner")

    async def test_unknown_interests_steps_and_oversize_names_are_rejected(self):
        for body in ({"interests": ["unknown"]}, {"step": "paid"}, {"name": "a" * 129}):
            self.assertEqual((await self.client.patch("/api/me/onboarding", json=body)).status_code, 422)

    async def test_skipping_setup_can_complete_without_granting_premium(self):
        result = await self.client.patch("/api/me/onboarding", json={"step": "complete"})
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()["completed"])
        self.assertIsNotNone(result.json()["completed_at"])
        async with self.sessions() as session:
            user = await session.scalar(select(User).where(User.phone_number == PHONE))
            self.assertFalse(user.is_premium)
        reopened = await self.client.patch("/api/me/onboarding", json={"step": "interests"})
        self.assertFalse(reopened.json()["completed"])

    async def test_business_checkout_uses_verified_owner_and_existing_payment_service(self):
        with patch.object(me.usage_service, "get_or_create_user", AsyncMock(return_value=type("Account", (), {"id": 123})())), \
             patch.object(me.payment_service, "create_payment_link", AsyncMock(return_value="https://example.test/pay")) as checkout:
            response = await self.client.post("/api/me/upgrade", json={"plan": "business"})
            self.assertEqual(response.status_code, 200)
            checkout.assert_awaited_once_with("+" + PHONE, 123, plan="business")
            self.assertEqual((await self.client.post("/api/me/upgrade", json={"plan": "ultra"})).status_code, 422)

    async def test_existing_default_checkout_still_selects_pro(self):
        with patch.object(me.usage_service, "get_or_create_user", AsyncMock(return_value=type("Account", (), {"id": 123})())), \
             patch.object(me.payment_service, "create_payment_link", AsyncMock(return_value="https://example.test/pay")) as checkout:
            self.assertEqual((await self.client.post("/api/me/upgrade")).status_code, 200)
            checkout.assert_awaited_once_with("+" + PHONE, 123, plan="pro")

    async def test_plan_cards_and_business_profile_use_configured_prices_and_limits(self):
        async with self.sessions() as session:
            user = await session.scalar(select(User).where(User.phone_number == PHONE))
            user.is_premium = True
            user.plan_tier = "business"
        with patch.object(me.usage_service, "get_or_create_user", AsyncMock(return_value=user)), \
             patch.object(me, "async_session", self.sessions), \
             patch.object(me.composio, "get_user_connections", AsyncMock(return_value=[])):
            response = await self.client.get("/api/me")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["plan"]["name"], "Business")
        self.assertEqual(data["plan"]["price_inr"], me.settings.BUSINESS_PRICE_PAISE / 100)
        self.assertEqual(data["usage"]["daily_limit"], me.settings.BUSINESS_DAILY_LIMIT)
        plans = {plan["id"]: plan for plan in data["available_plans"]}
        self.assertEqual(plans["pro"]["price_inr"], me.settings.MONTHLY_PRICE_PAISE / 100)
        self.assertEqual(plans["pro"]["daily_limit"], me.settings.PAID_DAILY_LIMIT)
        self.assertEqual(plans["business"]["price_inr"], me.settings.BUSINESS_PRICE_PAISE / 100)
