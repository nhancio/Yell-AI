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
from app.services.memory import MemoryService
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
    async def run_message(self, state, first_today=True, latest=True, history=(), text="plan my week"):
        send = AsyncMock()
        process = AsyncMock(return_value=SimpleNamespace(
            full_response="Here you go", required_toolkit=None, intent="general",
            is_crisis=False, emotion=None))
        with patch.object(webhook.usage_service, "signup_state", AsyncMock(return_value=state)), \
             patch.object(webhook.usage_service, "check_usage", AsyncMock(return_value={"allowed": True})), \
             patch.object(webhook.usage_service, "increment_usage", AsyncMock()), \
             patch.object(webhook.whatsapp, "send_message", send), \
             patch.object(webhook.orchestrator, "process", process), \
             patch.object(webhook.memory, "get_conversation_history", AsyncMock(return_value=list(history))), \
             patch.object(webhook.memory, "add_message", AsyncMock()), \
             patch.object(webhook.memory, "first_today", AsyncMock(return_value=first_today)), \
             patch.object(webhook.memory, "is_latest", AsyncMock(return_value=latest)), \
             patch.object(webhook.composio_service, "get_user_connections", AsyncMock(return_value=[])), \
             patch.object(webhook.ads_service, "get_contextual_ad", AsyncMock(return_value=None)), \
             patch.object(webhook, "async_session", lambda: _FlowLogSink()), \
             patch.object(webhook, "BURST_WAIT_SECONDS", 0):
            result = await webhook.process_user_message(PHONE, text, "wamid.1", "Ravi Kumar", 0)
        return result, process, send.await_args.args[1] if send.await_args else None

    async def test_exhausted_preview_sends_onboarding_link_without_ai(self):
        result, process, reply = await self.run_message((False, 0))
        self.assertEqual(result, {"status": "signup_required"})
        process.assert_not_awaited()
        self.assertIn("tryastra.web.app", reply)
        self.assertIn(f"+{PHONE}", reply)

    async def test_link_already_sent_today_stays_silent(self):
        result, process, reply = await self.run_message((False, 0), first_today=False)
        self.assertEqual(result, {"status": "signup_required"})
        process.assert_not_awaited()
        self.assertIsNone(reply)

    async def test_preview_reply_carries_remaining_count(self):
        _, process, reply = await self.run_message((False, 2))
        process.assert_awaited_once()
        self.assertIn("Here you go", reply)
        self.assertIn("1 free message left", reply)

    async def test_newer_message_drops_this_reply(self):
        result, process, reply = await self.run_message((True, 0), latest=False)
        self.assertEqual(result, {"status": "superseded"})
        process.assert_not_awaited()
        self.assertIsNone(reply)

    async def test_burst_of_unanswered_messages_gets_one_combined_reply(self):
        history = [{"role": "user", "content": "hi there"}, {"role": "assistant", "content": "Hey!"},
                   {"role": "user", "content": "draft a leave application"},
                   {"role": "user", "content": "also SIP for 15k?"}]
        _, process, _ = await self.run_message((True, 0), history=history, text="also SIP for 15k?")
        text, past = process.await_args.args[:2]
        self.assertEqual(text, "draft a leave application\nalso SIP for 15k?")
        self.assertEqual(past, history[:2])

    async def test_signed_up_reply_has_no_nudge(self):
        _, _, reply = await self.run_message((True, 0))
        self.assertEqual(reply, "Here you go")


class FirstTodayTests(unittest.IsolatedAsyncioTestCase):
    async def test_latest_message_wins_locally(self):
        service = MemoryService()
        with patch.object(service, "_get_redis", AsyncMock(return_value=None)):
            self.assertTrue(await service.is_latest(PHONE, "wamid.1"))
            await service.mark_latest(PHONE, "wamid.1")
            await service.mark_latest(PHONE, "wamid.2")
            self.assertFalse(await service.is_latest(PHONE, "wamid.1"))
            self.assertTrue(await service.is_latest(PHONE, "wamid.2"))

    async def test_local_fallback_allows_once_per_key(self):
        service = MemoryService()
        with patch.object(service, "_get_redis", AsyncMock(return_value=None)):
            self.assertTrue(await service.first_today("signup_link:1"))
            self.assertFalse(await service.first_today("signup_link:1"))
            self.assertTrue(await service.first_today("signup_link:2"))

    async def test_without_redis_separate_instances_share_the_database(self):
        a, b = MemoryService(), MemoryService()
        phone = "919800000001"
        with patch.object(a, "_get_redis", AsyncMock(return_value=None)), \
             patch.object(b, "_get_redis", AsyncMock(return_value=None)):
            await a.set_value("astra:wa_login:SHARED01", "pending", ttl=60)
            self.assertEqual(await b.pop_value("astra:wa_login:SHARED01"), "pending")
            self.assertIsNone(await a.pop_value("astra:wa_login:SHARED01"))

            await b.set_value("astra:gone", "x", ttl=-1)
            self.assertIsNone(await a.get_value("astra:gone"))

            for i in range(55):
                await a.add_message(phone, "user", f"m{i}")
            history = await b.get_conversation_history(phone, limit=100)
            self.assertEqual([m["content"] for m in history], [f"m{i}" for i in range(5, 55)])
            await b.clear_history(phone)
            self.assertEqual(await a.get_conversation_history(phone), [])

    async def test_redis_uses_atomic_set_nx_with_ttl(self):
        redis = AsyncMock()
        redis.set.side_effect = [True, None]
        service = MemoryService(redis_client=redis)
        self.assertTrue(await service.first_today("k"))
        self.assertFalse(await service.first_today("k"))
        redis.set.assert_awaited_with("astra:once:k", 1, nx=True, ex=86400)


if __name__ == "__main__":
    unittest.main()
