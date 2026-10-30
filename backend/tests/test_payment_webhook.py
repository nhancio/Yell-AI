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

    async def test_webhook_extracts_customer_contact_and_name_when_notes_have_no_phone(self):
        body = json.dumps({
            "event": "payment_link.paid",
            "payload": {
                "payment_link": {
                    "entity": {
                        "notes": {"product": PRODUCT_TAG, "plan_tier": "business"},
                        "customer": {"contact": "+91 83745 48218", "name": "Nithin", "email": "n@example.com"},
                    }
                }
            },
        }).encode()
        resp, activate = await self.post(body)
        self.assertEqual(resp.status_code, 200)
        activate.assert_awaited_once_with("918374548218", plan_tier="business", name="Nithin")

    async def test_direct_checkout_redirects_straight_to_razorpay_and_success_redirects_to_login(self):
        app = FastAPI()
        app.include_router(payment.router)
        with patch.object(payment.payment_service, "create_payment_link", AsyncMock(return_value="https://rzp.io/i/pro99")), \
             patch.object(payment.payment_service, "complete_callback", AsyncMock(return_value={
                 "phone_number": "918374548218",
                 "name": "Nithin",
                 "email": "n@example.com",
                 "plan_tier": "pro",
             })):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as client:
                checkout_resp = await client.get("/payment/checkout?plan=pro", follow_redirects=False)
                self.assertEqual(checkout_resp.status_code, 302)
                self.assertEqual(checkout_resp.headers["location"], "https://rzp.io/i/pro99")

                success_resp = await client.get("/payment/success?razorpay_payment_link_id=plink_1", follow_redirects=False)
                self.assertEqual(success_resp.status_code, 302)
                self.assertIn("/app?paid=1&plan=pro&phone=918374548218&name=Nithin", success_resp.headers["location"])



if __name__ == "__main__":
    unittest.main()
