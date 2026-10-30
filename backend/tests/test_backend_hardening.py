"""Regression tests for dependency failures and legacy HTTP trust boundaries."""

import hashlib
import hmac
import json
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from fastapi import FastAPI

from app.config import DEFAULT_REDIS_URL, Settings, get_settings
from app.models import database
from app.routes import brands, connectors, health, payment, webhook
from app.services.memory import MemoryService

settings = get_settings()
PHONE, OTHER = "919876543210", "919876543211"


def session_factory():
    session = AsyncMock()
    session.scalar.return_value = 0
    session.execute.return_value = MagicMock()
    session.execute.return_value.scalar_one_or_none.return_value = SimpleNamespace(
        id=1, budget_paise=500, is_active=False)
    factory = MagicMock()
    factory.return_value.__aenter__ = AsyncMock(return_value=session)
    factory.return_value.__aexit__ = AsyncMock(return_value=False)
    return factory


class DependencyTests(unittest.IsolatedAsyncioTestCase):
    async def test_default_redis_url_is_a_real_connection(self):
        client = AsyncMock()
        client.ping.return_value = True
        with patch.object(settings, "REDIS_URL", DEFAULT_REDIS_URL), \
             patch("app.services.memory.aioredis.from_url", return_value=client):
            self.assertIs(await MemoryService()._get_redis(), client)

    async def test_failed_redis_client_is_closed(self):
        client = AsyncMock()
        client.ping.side_effect = ConnectionError("unavailable")
        with patch.object(settings, "REDIS_URL", "redis://127.0.0.1:6399"), \
             patch("app.services.memory.aioredis.from_url", return_value=client):
            await MemoryService()._get_redis()
        client.aclose.assert_awaited_once()

    async def test_redis_outage_cannot_silently_use_local_memory_in_production(self):
        client = AsyncMock()
        client.ping.side_effect = ConnectionError("unavailable")
        with patch.dict(settings.__dict__, {"ENVIRONMENT": "production"}), \
             patch("app.services.memory.aioredis.from_url", return_value=client):
            with self.assertRaises(RuntimeError):
                await MemoryService().add_message(PHONE, "user", "do not lose this")

    async def test_table_initialization_does_not_swallow_database_failure(self):
        engine = MagicMock()
        engine.begin.return_value.__aenter__ = AsyncMock(side_effect=RuntimeError("database failed"))
        with patch.object(database, "engine", engine), patch.object(database, "_tables_initialized", False):
            with self.assertRaises(RuntimeError):
                await database.ensure_tables()

    def test_backend_database_url_takes_precedence_over_frontend_url(self):
        config = Settings(_env_file=None, DATABASE_URL="file:./frontend.db",
                          BACKEND_DATABASE_URL="postgresql+asyncpg://user:pass@localhost/backend")
        self.assertEqual(getattr(config, "effective_database_url", None),
                         "postgresql+asyncpg://user:pass@localhost/backend")

    def test_production_rejects_ephemeral_sqlite(self):
        with self.assertRaises(ValueError):
            Settings(_env_file=None, ENVIRONMENT="production", DATABASE_URL="sqlite+aiosqlite:////tmp/app.db")

    def test_deployment_cannot_use_local_services_or_missing_secrets(self):
        local = Settings(_env_file=None, BACKEND_DATABASE_URL="postgresql+asyncpg://user:pass@localhost/app")
        with self.assertRaises(ValueError):
            local.production_environment()
        hosted = Settings(_env_file=None, BACKEND_DATABASE_URL="postgresql+asyncpg://user:pass@db.example/app",
                          REDIS_URL="rediss://:pass@redis.example:6380/0", ADMIN_API_KEY="a" * 48,
                          WHATSAPP_TOKEN="token", WHATSAPP_PHONE_NUMBER_ID="phone", WHATSAPP_APP_SECRET="secret",
                          WHATSAPP_VERIFY_TOKEN="v" * 48)
        deployed = hosted.production_environment()
        self.assertEqual(deployed["ENVIRONMENT"], "production")
        self.assertEqual(deployed["ALLOW_MEMORY_FALLBACK"], "false")
        self.assertEqual(deployed["DATABASE_URL"], hosted.effective_database_url)
        hosted.WHATSAPP_APP_SECRET = ""
        with self.assertRaises(ValueError):
            hosted.production_environment()


class LegacyApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        app = FastAPI()
        for router in (health.router, brands.router, connectors.router, payment.router, webhook.router):
            app.include_router(router)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.patches = [
            patch.object(health, "async_session", session_factory()),
            patch.object(brands, "async_session", session_factory(), create=True),
            patch.object(brands.ads_service, "list_campaigns", AsyncMock(return_value=[])),
            patch.object(brands.ads_service, "create_campaign", AsyncMock(return_value={"id": 1})),
            patch.object(brands.ads_service, "toggle_campaign", AsyncMock(return_value=False)),
            patch.object(connectors.ads_service, "list_campaigns", AsyncMock(return_value=[])),
            patch.object(brands, "payment_service", SimpleNamespace(client=None), create=True),
            patch("app.services.usage.UsageService.get_or_create_user", AsyncMock(return_value=SimpleNamespace(
                id=1, is_premium=False, premium_expires_at=None))),
            patch.object(payment.payment_service, "create_payment_link", AsyncMock(return_value="https://example.test/pay")),
        ]
        for p in self.patches:
            p.start()

    async def asyncTearDown(self):
        for p in reversed(self.patches):
            p.stop()
        await self.client.aclose()

    async def test_legacy_admin_routes_reject_anonymous_requests(self):
        requests = [
            ("GET", "/stats", None),
            ("GET", "/api/ads/campaigns", None),
            ("GET", "/api/brands/campaigns", None),
            ("POST", "/api/brands/campaigns", {"brand_name": "Test", "category": "general", "headline": "Test", "cta_text": "Visit", "cta_url": "https://example.test"}),
            ("POST", "/api/brands/campaigns/1/prepay", {"amount_inr": 1}),
            ("POST", "/api/brands/campaigns/1/verify-payment", {"razorpay_order_id": "order_1", "razorpay_payment_id": "pay_1", "razorpay_signature": "bad", "amount_inr": 1}),
            ("PATCH", "/api/brands/campaigns/1/toggle", None),
        ]
        for method, path, body in requests:
            with self.subTest(path=path):
                self.assertEqual((await self.client.request(method, path, json=body)).status_code, 403)

    async def test_legacy_payment_routes_require_identity(self):
        for method, path, body in [
            ("POST", "/payment/create-link", {"phone_number": PHONE}),
            ("GET", f"/payment/status/{PHONE}", None),
        ]:
            self.assertEqual((await self.client.request(method, path, json=body)).status_code, 401)

    async def test_payment_identity_cannot_claim_another_phone(self):
        with patch("app.services.auth.verify_firebase_token", AsyncMock(return_value={"phone_number": PHONE})):
            headers = {"Authorization": "Bearer test"}
            self.assertEqual((await self.client.post("/payment/create-link", headers=headers,
                                                    json={"phone_number": OTHER})).status_code, 403)
            self.assertEqual((await self.client.get(f"/payment/status/{OTHER}", headers=headers)).status_code, 403)

    async def test_admin_cannot_use_unsafe_legacy_wallet_credit(self):
        key, secret = "long-random-test-admin-key-32-characters", "test-provider-secret"
        signature = hmac.new(secret.encode(), b"order_1|pay_1", hashlib.sha256).hexdigest()
        with patch.object(settings, "ADMIN_API_KEY", key), patch.object(settings, "RAZORPAY_KEY_SECRET", secret), \
             patch.object(brands, "payment_service", SimpleNamespace(client=MagicMock()), create=True):
            response = await self.client.post("/api/brands/campaigns/1/verify-payment",
                headers={"X-Admin-Key": key}, json={"razorpay_order_id": "order_1",
                "razorpay_payment_id": "pay_1", "razorpay_signature": signature, "amount_inr": 1000000})
            self.assertEqual(response.status_code, 503)

    async def test_readiness_checks_real_dependency_availability(self):
        engine = MagicMock()
        engine.connect.return_value.__aenter__ = AsyncMock(return_value=AsyncMock())
        memory = SimpleNamespace(ping=AsyncMock(return_value=True))
        with patch.object(health, "engine", engine, create=True), \
             patch.object(health, "memory_service", memory, create=True):
            self.assertEqual((await self.client.get("/ready")).status_code, 200)
            engine.connect.return_value.__aenter__.side_effect = RuntimeError("postgres://db-password")
            result = await self.client.get("/ready")
            self.assertEqual(result.status_code, 503)
            self.assertNotIn("db-password", result.text)
            engine.connect.return_value.__aenter__.side_effect = None
            memory.ping.return_value = False
            self.assertEqual((await self.client.get("/ready")).status_code, 503)

    async def test_signed_webhook_requires_algorithm_prefix(self):
        body = b'{"entry": []}'
        signature = hmac.new(b"meta-test-secret", body, hashlib.sha256).hexdigest()
        with patch.object(settings, "WHATSAPP_APP_SECRET", "meta-test-secret"):
            response = await self.client.post("/webhook", content=body, headers={"X-Hub-Signature-256": signature})
            self.assertEqual(response.status_code, 401)

    async def test_malformed_signed_json_is_rejected(self):
        for body in (b"not-json", b"[]"):
            signature = hmac.new(b"meta-test-secret", body, hashlib.sha256).hexdigest()
            with patch.object(settings, "WHATSAPP_APP_SECRET", "meta-test-secret"):
                response = await self.client.post("/webhook", content=body,
                                                  headers={"X-Hub-Signature-256": "sha256=" + signature})
                self.assertEqual(response.status_code, 400)

    async def test_oversize_webhook_is_rejected(self):
        body = b"x" * 1048577
        signature = hmac.new(b"meta-test-secret", body, hashlib.sha256).hexdigest()
        with patch.object(settings, "WHATSAPP_APP_SECRET", "meta-test-secret"):
            response = await self.client.post("/webhook", content=body,
                                              headers={"X-Hub-Signature-256": "sha256=" + signature})
            self.assertEqual(response.status_code, 413)

    async def test_public_default_subscription_token_is_rejected(self):
        with patch.object(settings, "WHATSAPP_VERIFY_TOKEN", "yellai-verify-token"):
            response = await self.client.get("/webhook", params={"hub.mode": "subscribe",
                "hub.verify_token": "yellai-verify-token", "hub.challenge": "challenge"})
            self.assertEqual(response.status_code, 403)

    async def test_private_subscription_token_preserves_meta_handshake(self):
        with patch.object(settings, "WHATSAPP_VERIFY_TOKEN", "private-verification-token"):
            response = await self.client.get("/webhook", params={"hub.mode": "subscribe",
                "hub.verify_token": "private-verification-token", "hub.challenge": "12345"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.text, "12345")
