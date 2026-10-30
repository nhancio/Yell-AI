"""Numbers that never logged in get a short preview, then the onboarding link."""

from datetime import date
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.database import Base
from app.models.onboarding import UserOnboarding
from app.models.user import User, UserUsage
from app.routes import webhook
from app.services import usage as usage_module
from app.services.usage import UsageService

PHONE = "918374548218"


class SignupStateTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        self.patches = [patch.object(usage_module, "async_session", self.sessions),
                        patch.object(usage_module, "ensure_tables", AsyncMock())]
        for p in self.patches:
            p.start()

    async def asyncTearDown(self):
        for p in self.patches:
            p.stop()
        await self.engine.dispose()

    async def test_unknown_number_gets_preview_then_none(self):
        service = UsageService()
        self.assertEqual(await service.signup_state(PHONE), (False, 2))
        await service.increment_usage(PHONE)
        self.assertEqual(await service.signup_state(PHONE), (False, 1))
        await service.increment_usage(PHONE)
        self.assertEqual(await service.signup_state(PHONE), (False, 0))

    async def test_app_login_or_payment_unlocks(self):
        service = UsageService()
        user = await service.get_or_create_user(PHONE)
        async with self.sessions() as session:
            session.add(UserUsage(user_id=user.id, date=date.today(), query_count=9))
            session.add(UserOnboarding(user_id=user.id, interests=[], step="name"))
            await session.commit()
        self.assertTrue((await service.signup_state(PHONE))[0])

        async with self.sessions() as session:
            session.add(User(phone_number="919999999999", is_premium=True))
            await session.commit()
        self.assertTrue((await service.signup_state("919999999999"))[0])


class _FlowLogSink:
    async def __aenter__(self):
        return AsyncMock()

    async def __aexit__(self, *exc):
        return False


class WebhookGateTests(unittest.IsolatedAsyncioTestCase):
    async def run_message(self, state):
        send = AsyncMock()
        process = AsyncMock(return_value=SimpleNamespace(
            full_response="Here you go", required_toolkit=None, intent="general",
            is_crisis=False, emotion=None))
        with patch.object(webhook.usage_service, "signup_state", AsyncMock(return_value=state)), \
             patch.object(webhook.usage_service, "check_usage", AsyncMock(return_value={"allowed": True})), \
             patch.object(webhook.usage_service, "increment_usage", AsyncMock()), \
             patch.object(webhook.whatsapp, "send_message", send), \
             patch.object(webhook.orchestrator, "process", process), \
             patch.object(webhook.memory, "get_conversation_history", AsyncMock(return_value=[])), \
             patch.object(webhook.memory, "add_message", AsyncMock()), \
             patch.object(webhook.composio_service, "get_user_connections", AsyncMock(return_value=[])), \
             patch.object(webhook.ads_service, "get_contextual_ad", AsyncMock(return_value=None)), \
             patch.object(webhook, "async_session", lambda: _FlowLogSink()):
            result = await webhook.process_user_message(PHONE, "plan my week", "wamid.1", "Ravi Kumar", 0)
        return result, process, send.await_args.args[1]

    async def test_exhausted_preview_sends_onboarding_link_without_ai(self):
        result, process, reply = await self.run_message((False, 0))
        self.assertEqual(result, {"status": "signup_required"})
        process.assert_not_awaited()
        self.assertIn("tryastra.web.app", reply)
        self.assertIn(f"+{PHONE}", reply)

    async def test_preview_reply_carries_remaining_count(self):
        _, process, reply = await self.run_message((False, 2))
        process.assert_awaited_once()
        self.assertIn("Here you go", reply)
        self.assertIn("1 free message left", reply)

    async def test_signed_up_reply_has_no_nudge(self):
        _, _, reply = await self.run_message((True, 0))
        self.assertEqual(reply, "Here you go")


if __name__ == "__main__":
    unittest.main()
