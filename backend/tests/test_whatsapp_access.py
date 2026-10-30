"""A verified website login is recorded only from a valid token, and unlocks WhatsApp for that phone only."""

from contextlib import ExitStack
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.database import Base, get_db
from app.routes import me
from app.services import auth
from app.services import usage as usage_module
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


if __name__ == "__main__":
    unittest.main()
