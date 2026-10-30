"""HTTP authentication boundaries; no provider network requests or real user accounts."""

import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.routes import connectors, me, tool_runs
from app.services.composio_service import ConnectorError

PHONE = "919876543210"


class ConnectorAuthTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.app = FastAPI()
        self.app.include_router(connectors.router)
        self.app.include_router(me.router)
        self.app.include_router(tool_runs.router)

        @self.app.exception_handler(ConnectorError)
        async def handle(request, exc):
            return JSONResponse({"detail": str(exc)}, status_code=exc.status_code)

        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_private_routes_require_login(self):
        endpoints = [
            ("GET", f"/api/connectors/status?phone={PHONE}", None),
            ("POST", "/api/connectors/link", {"phone_number": PHONE, "toolkit": "gmail"}),
            ("POST", "/api/connectors/confirm", {"phone_number": PHONE, "toolkit": "gmail"}),
            ("GET", "/api/me/connectors", None),
            ("POST", "/api/me/connectors/link", {"toolkit": "gmail"}),
            ("POST", "/api/me/connectors/gmail/confirm", None),
            ("DELETE", "/api/me/connectors/gmail", None),
            ("GET", "/api/me/connectors/gmail/tools", None),
            ("GET", "/api/me/tool-runs", None),
            ("POST", "/api/me/tool-runs", {"toolkit": "gmail", "tool_slug": "GMAIL_GET_PROFILE", "idempotency_key": "one"}),
            ("GET", "/api/me/tool-runs/foreign", None),
            ("POST", "/api/me/tool-runs/foreign/approve", None),
            ("POST", "/api/me/tool-runs/foreign/cancel", None),
        ]
        for method, path, body in endpoints:
            with self.subTest(path=path):
                response = await self.client.request(method, path, json=body)
                self.assertEqual(response.status_code, 401)

    async def test_legacy_routes_reject_claiming_another_users_phone(self):
        with patch("app.services.auth.verify_firebase_token", AsyncMock(return_value={"phone_number": "+" + PHONE})):
            for path in ("link", "confirm"):
                response = await self.client.post("/api/connectors/" + path,
                    headers={"Authorization": "Bearer test"},
                    json={"phone_number": "919876543211", "toolkit": "gmail"})
                self.assertEqual(response.status_code, 403)
            response = await self.client.get("/api/connectors/status?phone=919876543211",
                                             headers={"Authorization": "Bearer test"})
            self.assertEqual(response.status_code, 403)

    async def test_email_only_identity_cannot_access_connections(self):
        with patch("app.services.auth.verify_firebase_token", AsyncMock(return_value={"sub": "email-user"})):
            response = await self.client.get("/api/me/connectors", headers={"Authorization": "Bearer test"})
            self.assertEqual(response.status_code, 403)

    async def test_invalid_session_is_rejected(self):
        with patch("app.services.auth.id_token.verify_firebase_token", side_effect=ValueError("expired")):
            response = await self.client.get("/api/me/connectors", headers={"Authorization": "Bearer expired"})
            self.assertEqual(response.status_code, 401)

    async def test_confirm_never_sends_an_unsolicited_whatsapp_message(self):
        with patch("app.services.auth.verify_firebase_token", AsyncMock(return_value={"phone_number": PHONE})), \
             patch.object(connectors.composio_service, "mark_connected", AsyncMock(return_value={"status": "active", "newly_active": True})), \
             patch.object(connectors.whatsapp_service, "send_message", AsyncMock()) as send:
            response = await self.client.post("/api/connectors/confirm", headers={"Authorization": "Bearer test"},
                                              json={"phone_number": PHONE, "toolkit": "gmail"})
            self.assertEqual(response.status_code, 200)
            send.assert_not_called()

    async def test_raw_execution_endpoint_is_removed(self):
        response = await self.client.post("/api/connectors/execute", json={"phone_number": PHONE})
        self.assertEqual(response.status_code, 404)

    async def test_firebase_owner_overrides_arbitrary_extra_phone_fields(self):
        with patch("app.services.auth.verify_firebase_token", AsyncMock(return_value={"phone_number": PHONE})), \
             patch.object(me.composio, "create_auth_link", AsyncMock(return_value={"status": "pending"})) as link:
            response = await self.client.post("/api/me/connectors/link", headers={"Authorization": "Bearer test"},
                json={"toolkit": "gmail", "phone_number": "919876543211"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(link.call_args.kwargs["phone_number"], PHONE)
