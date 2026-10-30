"""Inbound webhooks and admin routes must not trust unsigned or default-keyed requests."""

import hashlib
import hmac
import json
import unittest
from unittest.mock import patch

import httpx
from fastapi import FastAPI

from app.config import get_settings
from app.routes import admin, webhook
from app.services.payment import PaymentService

settings = get_settings()
BODY = json.dumps({"entry": []}).encode()  # parses to "ignored", so nothing is processed or sent


def sign(secret: str) -> str:
    return hmac.new(secret.encode(), BODY, hashlib.sha256).hexdigest()


class WebhookSecurityTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        app = FastAPI()
        app.include_router(webhook.router)
        app.include_router(admin.router)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def post_webhook(self, headers: dict[str, str]) -> httpx.Response:
        return await self.client.post("/webhook", content=BODY, headers=headers)

    async def test_whatsapp_webhook_rejects_unsigned_and_forged(self):
        with patch.object(settings, "WHATSAPP_APP_SECRET", "meta-secret"):
            self.assertEqual((await self.post_webhook({})).status_code, 401)
            self.assertEqual((await self.post_webhook({"X-Hub-Signature-256": "sha256=" + sign("wrong")})).status_code, 401)
            self.assertEqual((await self.post_webhook({"X-Hub-Signature-256": "sha256=" + sign("meta-secret")})).status_code, 200)

    async def test_whatsapp_webhook_rejects_everything_without_secret(self):
        with patch.object(settings, "WHATSAPP_APP_SECRET", ""):
            # An empty secret must not make an empty-key HMAC acceptable
            self.assertEqual((await self.post_webhook({"X-Hub-Signature-256": "sha256=" + sign("")})).status_code, 401)

    async def test_admin_refuses_blank_or_old_default_key(self):
        for configured in ("", "supersecretadmin123"):
            with patch.object(settings, "ADMIN_API_KEY", configured):
                res = await self.client.get("/admin/stats", headers={"X-Admin-Key": configured or "x"})
                self.assertEqual(res.status_code, 403, configured)

    def test_razorpay_rejects_blank_secret(self):
        with patch.object(settings, "RAZORPAY_WEBHOOK_SECRET", ""), patch.object(settings, "RAZORPAY_KEY_SECRET", ""):
            self.assertFalse(PaymentService().verify_payment("", sign(""), BODY))
        with patch.object(settings, "RAZORPAY_WEBHOOK_SECRET", "rzp-secret"):
            self.assertTrue(PaymentService().verify_payment("", sign("rzp-secret"), BODY))
            self.assertFalse(PaymentService().verify_payment("", sign("wrong"), BODY))


if __name__ == "__main__":
    unittest.main()
