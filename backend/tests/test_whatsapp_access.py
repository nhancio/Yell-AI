"""A verified website login must precede all WhatsApp agent access."""

from contextlib import ExitStack
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.database import Base, get_db
from app.models.user import User
from app.routes import me, webhook
from app.services import auth

PHONE, OTHER = "919876543210", "919876543211"


class WhatsAppAccessTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async def db():
            async with self.sessions() as session:
                yield session

        app = FastAPI()
        app.include_router(me.router)
        app.dependency_overrides[get_db] = db
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.mocks = ExitStack()
        self.addCleanup(self.mocks.close)
        self.mocks.enter_context(patch.object(auth, "async_session", self.sessions, create=True))
        self.mocks.enter_context(patch.object(auth, "ensure_tables", AsyncMock(), create=True))
        self.mocks.enter_context(patch.object(webhook, "async_session", self.sessions))
        self.send = self.mocks.enter_context(patch.object(webhook.whatsapp, "send_message", AsyncMock()))
        self.memory = self.mocks.enter_context(patch.object(webhook, "memory", AsyncMock()))
        self.connections = self.mocks.enter_context(patch.object(webhook.composio_service, "get_user_connections", AsyncMock(return_value=[])))
        self.usage = self.mocks.enter_context(patch.object(webhook.usage_service, "check_usage", AsyncMock(return_value={"allowed": True})))
        self.mocks.enter_context(patch.object(webhook.usage_service, "get_or_create_user", AsyncMock(return_value=SimpleNamespace(id=1))))
        self.mocks.enter_context(patch.object(webhook.payment_service, "create_payment_link", AsyncMock(return_value=None)))
        self.mocks.enter_context(patch.object(webhook.usage_service, "increment_usage", AsyncMock()))
        self.agent = self.mocks.enter_context(patch.object(webhook.orchestrator, "process", AsyncMock(return_value=SimpleNamespace(
            full_response="PRIVATE_AGENT_REPLY", required_toolkit=None, intent="general", is_crisis=False, emotion="neutral"))))
        self.mocks.enter_context(patch.object(webhook.ads_service, "get_contextual_ad", AsyncMock(return_value=None)))

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.engine.dispose()

    async def login(self, phone=PHONE, **kwargs):
        with patch.object(auth, "verify_firebase_token", AsyncMock(return_value={"phone_number": f"+{phone}"})):
            return await self.client.post("/api/me/session", headers={"Authorization": "Bearer verified-test-token"}, **kwargs)

    async def message(self, text, phone=PHONE):
        await webhook.process_user_message(sender=phone, text=text, message_id="wamid.access-test", sender_name="Owner", log_id=0)

    async def test_missing_invalid_or_unverified_login_cannot_register(self):
        self.assertEqual((await self.client.post("/api/me/session")).status_code, 401)
        with patch.object(auth, "verify_firebase_token", AsyncMock(side_effect=auth.HTTPException(401, "Expired"))):
            self.assertEqual((await self.client.post("/api/me/session", headers={"Authorization": "Bearer expired"})).status_code, 401)
        with patch.object(auth, "verify_firebase_token", AsyncMock(return_value={"sub": "no-phone"})):
            self.assertEqual((await self.client.post("/api/me/session", headers={"Authorization": "Bearer no-phone"})).status_code, 403)

    async def test_existing_usage_profile_does_not_prove_login(self):
        async with self.sessions() as db:
            db.add(User(phone_number=PHONE))
            await db.commit()
        await self.message("hello")
        self.assertIn("/app", self.send.call_args.args[1])
        self.assertNotIn("Namaste", self.send.call_args.args[1])

    async def test_every_command_and_agent_path_is_blocked_before_login(self):
        for text in ("hello", "/start", "connect gmail", "/connect", "/clear", "/upgrade", "summarize my email"):
            with self.subTest(text=text):
                self.send.reset_mock()
                await self.message(text)
                self.send.assert_awaited_once()
                self.assertIn("/app", self.send.call_args.args[1])
        self.agent.assert_not_awaited()
        self.usage.assert_not_awaited()
        self.connections.assert_not_awaited()
        self.memory.add_message.assert_not_awaited()
        self.memory.clear_history.assert_not_awaited()

    async def test_verified_login_is_idempotent_and_unlocks_only_token_phone(self):
        for _ in range(2):
            result = await self.login(json={"phone_number": OTHER})
            self.assertEqual(result.status_code, 200)
        await self.message("hello")
        self.assertIn("Namaste", self.send.call_args.args[1])
        await self.message("summarize my email")
        self.agent.assert_awaited_once()
        self.assertEqual(self.send.call_args.args[1], "PRIVATE_AGENT_REPLY")
        await self.message("hello", OTHER)
        self.assertIn("/app", self.send.call_args.args[1])

    async def test_access_check_fails_closed_when_storage_is_unavailable(self):
        with patch.object(auth, "ensure_tables", AsyncMock(side_effect=RuntimeError("database unavailable")), create=True):
            await self.message("summarize my email")
        self.agent.assert_not_awaited()
        self.connections.assert_not_awaited()
        self.assertNotIn("database unavailable", self.send.call_args.args[1])
