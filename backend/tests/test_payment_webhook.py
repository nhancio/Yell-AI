"""The shared Razorpay account must only grant Astra plans for Astra-tagged links."""

import hashlib
import hmac
import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI

from app.routes import payment
from app.services.payment import PRODUCT_TAG

SECRET = "test-webhook-secret"


def paid_event(notes: dict) -> bytes:
    return json.dumps({"event": "payment_link.paid",
                       "payload": {"payment_link": {"entity": {"notes": notes}}}}).encode()


class PaymentWebhookTests(unittest.IsolatedAsyncioTestCase):
    async def post(self, body: bytes, signature: str | None = None):
        app = FastAPI()
        app.include_router(payment.router)
        sig = signature if signature is not None else hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
        activate = AsyncMock(return_value=True)
        with patch.object(payment.settings, "RAZORPAY_WEBHOOK_SECRET", SECRET), \
             patch.object(payment.payment_service, "activate_premium", activate):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as client:
                resp = await client.post("/payment/webhook", content=body,
                                         headers={"X-Razorpay-Signature": sig})
        return resp, activate

    async def test_astra_link_grants_plan(self):
        resp, activate = await self.post(paid_event(
            {"product": PRODUCT_TAG, "phone_number": "918374548218", "plan_tier": "pro"}))
        self.assertEqual(resp.status_code, 200)
        activate.assert_awaited_once_with("918374548218", plan_tier="pro")

    async def test_other_product_link_is_ignored(self):
        for notes in ({"phone_number": "918374548218"}, {"product": "tweleb", "phone_number": "918374548218"}):
            resp, activate = await self.post(paid_event(notes))
            self.assertEqual(resp.json(), {"status": "ignored"})
            activate.assert_not_awaited()

    async def test_bad_signature_is_rejected(self):
        resp, activate = await self.post(paid_event({"product": PRODUCT_TAG, "phone_number": "1"}), "bad")
        self.assertEqual(resp.status_code, 401)
        activate.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
