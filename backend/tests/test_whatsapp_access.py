"""A verified website login is recorded only from a valid token, and unlocks WhatsApp for that phone only."""

from contextlib import ExitStack
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.database import Base, get_db
from app.routes import me, webhook
from app.services import auth
from app.services import usage as usage_module
from app.services.memory import memory_service
from app.services.usage import UsageService

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
        for module in (auth, usage_module):
            self.mocks.enter_context(patch.object(module, "async_session", self.sessions, create=True))
            self.mocks.enter_context(patch.object(module, "ensure_tables", AsyncMock(), create=True))

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.engine.dispose()

    async def login(self, phone=PHONE, **kwargs):
        with patch.object(auth, "verify_firebase_token", AsyncMock(return_value={"phone_number": f"+{phone}"})):
            return await self.client.post("/api/me/session", headers={"Authorization": "Bearer verified-test-token"}, **kwargs)

    async def test_missing_invalid_or_unverified_login_cannot_register(self):
        self.assertEqual((await self.client.post("/api/me/session")).status_code, 401)
        with patch.object(auth, "verify_firebase_token", AsyncMock(side_effect=auth.HTTPException(401, "Expired"))):
            self.assertEqual((await self.client.post("/api/me/session", headers={"Authorization": "Bearer expired"})).status_code, 401)
        with patch.object(auth, "verify_firebase_token", AsyncMock(return_value={"sub": "no-phone"})):
            self.assertEqual((await self.client.post("/api/me/session", headers={"Authorization": "Bearer no-phone"})).status_code, 403)

    async def test_verified_login_is_idempotent_and_unlocks_only_token_phone(self):
        service = UsageService()
        self.assertFalse((await service.signup_state(PHONE))[0])
        for _ in range(2):
            # The body tries to claim another number; only the token's phone may be recorded.
            result = await self.login(json={"phone_number": OTHER})
            self.assertEqual(result.status_code, 200)
        self.assertTrue((await service.signup_state(PHONE))[0])
        self.assertTrue(await auth.has_verified_whatsapp_login(PHONE))
        self.assertEqual(await service.signup_state(OTHER), (False, 2))

    async def test_whatsapp_challenge_flow_and_magic_link_ticket(self):
        with patch.object(memory_service, "_get_redis", AsyncMock(return_value=None)), \
             patch.object(webhook.whatsapp, "send_message", AsyncMock()) as send_wa, \
             patch.object(webhook, "async_session", self.sessions):
            start_res = await self.client.post("/api/me/whatsapp-login/start")
            self.assertEqual(start_res.status_code, 200)
            challenge = start_res.json()
            code = challenge["code"]
            poll_token = challenge["poll_token"]
            self.assertIn(code, challenge["whatsapp_url"])

            # Still pending before user sends the WhatsApp message
            pending_res = await self.client.post(
                "/api/me/whatsapp-login/poll",
                json={"code": code, "poll_token": poll_token},
            )
            self.assertEqual(pending_res.status_code, 200)
            self.assertEqual(pending_res.json(), {"status": "pending"})

            # Wrong poll_token is rejected
            bad_poll = await self.client.post(
                "/api/me/whatsapp-login/poll",
                json={"code": code, "poll_token": "wrong-token"},
            )
            self.assertEqual(bad_poll.status_code, 403)

            # User sends the pre-filled message on WhatsApp
            wh_result = await webhook.process_user_message(
                PHONE,
                f"Sign in to Astra (code: {code})",
                "wamid.login1",
                "Nithi",
                0,
            )
            self.assertEqual(wh_result, {"status": "logged_in"})
            send_wa.assert_awaited_once()
            reply_text = send_wa.await_args.args[1]
            self.assertIn("wa_token=", reply_text)

            # Browser poll now receives the verified WhatsApp session token
            verified_res = await self.client.post(
                "/api/me/whatsapp-login/poll",
                json={"code": code, "poll_token": poll_token},
            )
            self.assertEqual(verified_res.status_code, 200)
            verified_body = verified_res.json()
            self.assertEqual(verified_body["status"], "verified")
            self.assertEqual(verified_body["phone_number"], f"+{PHONE}")
            wa_token = verified_body["token"]
            self.assertTrue(wa_token.startswith("wa."))

            # Re-polling the consumed challenge fails with 404
            replay_poll = await self.client.post(
                "/api/me/whatsapp-login/poll",
                json={"code": code, "poll_token": poll_token},
            )
            self.assertEqual(replay_poll.status_code, 404)

            # The wa.* session token works across authenticated /api/me/session routes
            session_res = await self.client.post(
                "/api/me/session",
                headers={"Authorization": f"Bearer {wa_token}"},
            )
            self.assertEqual(session_res.status_code, 200)
            self.assertTrue(await auth.has_verified_whatsapp_login(PHONE))

            # Tampered or expired wa.* tokens are rejected
            tampered = wa_token[:-4] + "0000"
            self.assertEqual(
                (await self.client.post("/api/me/session", headers={"Authorization": f"Bearer {tampered}"})).status_code,
                401,
            )
            expired = auth.create_whatsapp_session_token(PHONE, ttl_seconds=-10)
            self.assertEqual(
                (await self.client.post("/api/me/session", headers={"Authorization": f"Bearer {expired}"})).status_code,
                401,
            )

            # 1-tap magic link ticket exchange works once and rejects replay
            ticket = reply_text.split("wa_token=")[1].split()[0].strip()
            ex1 = await self.client.post("/api/me/whatsapp-login/exchange", json={"ticket": ticket})
            self.assertEqual(ex1.status_code, 200)
            self.assertTrue(ex1.json()["token"].startswith("wa."))
            ex2 = await self.client.post("/api/me/whatsapp-login/exchange", json={"ticket": ticket})
            self.assertEqual(ex2.status_code, 401)


if __name__ == "__main__":
    unittest.main()
