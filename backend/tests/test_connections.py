"""Integration contracts exercised against isolated SQLite and a fake provider."""

import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import Settings
from app.models.database import Base
from app.models.user import UserConnection
from app.services.composio_service import SUPPORTED_TOOLKITS, ComposioService, ConnectorError, entity_id_for_phone
from app.services.tool_runs import ToolRunService

PHONE = "919876543210"
OTHER = "919876543211"


class ConnectionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.requests = []
        self.account = {
            "id": "ca_mine", "user_id": entity_id_for_phone(PHONE),
            "toolkit": {"slug": "todoist"}, "status": "ACTIVE",
        }
        self.execution = {"successful": True, "data": {"id": "contact_123"}, "error": None}
        self.timeout = False
        self.provider_status = 200
        self.config = Settings(_env_file=None, COMPOSIO_API_KEY="test-key",
                               COMPOSIO_AUTH_CONFIGS={"todoist": "ac_todo"})
        self.service = ComposioService(
            config=self.config, session_factory=self.sessions, initialize=AsyncMock(),
            transport=httpx.MockTransport(self.respond),
        )
        self.runs = ToolRunService(self.service)
        async with self.sessions() as session:
            session.add(UserConnection(phone_number=PHONE, toolkit="todoist",
                                       connection_id="ca_mine", status="active"))
            await session.commit()

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def respond(self, request):
        self.requests.append(request)
        path = request.url.path
        if "/tools/execute/" in path:
            if self.timeout:
                raise httpx.ReadTimeout("unknown outcome", request=request)
            return httpx.Response(self.provider_status, json=self.execution)
        if path.endswith("/tools/TODOIST_CREATE_TASK"):
            return httpx.Response(200, json={
                "slug": "TODOIST_CREATE_TASK", "toolkit": {"slug": "todoist"},
                "version": "20261029_00", "input_parameters": {"type": "object"},
            })
        if path.endswith("/tools"):
            return httpx.Response(200, json={"items": [], "next_cursor": None})
        if path.endswith("/link"):
            return httpx.Response(self.provider_status, json={
                "redirect_url": "https://connect.composio.dev/link/test",
                "connected_account_id": "ca_pending",
            })
        if path.endswith("/connected_accounts"):
            return httpx.Response(200, json={"items": [self.account], "next_cursor": None})
        if request.method == "DELETE":
            return httpx.Response(200, json={"success": True})
        return httpx.Response(200, json=self.account)

    async def make_run(self, key="one"):
        return await self.runs.create(PHONE, "todoist", "TODOIST_CREATE_TASK",
                                      {"email": "founder@example.test"}, key)

    async def test_callback_cannot_activate_pending_provider_account(self):
        self.account["status"] = "INITIATED"
        result = await self.service.mark_connected(PHONE, "todoist")
        self.assertEqual(result["status"], "pending")

    async def test_foreign_provider_account_cannot_be_used(self):
        self.account["user_id"] = entity_id_for_phone(OTHER)
        with self.assertRaises(ConnectorError):
            await self.service.get_active_connection(PHONE, "todoist")

    async def test_revoked_connection_is_not_reported_active(self):
        self.account["status"] = "REVOKED"
        connections = await self.service.get_user_connections(PHONE)
        self.assertEqual(next(c for c in connections if c["slug"] == "todoist")["status"], "revoked")

    async def test_oauth_failure_has_no_fallback_or_fake_pending_connection(self):
        self.provider_status = 503
        with self.assertRaises(ConnectorError):
            await self.service.create_auth_link(PHONE, "todoist")

    async def test_unconfigured_app_has_no_auth_link(self):
        unconfigured = {"name": "X", "icon": "", "category": "", "description": "", "auth_config_id": ""}
        with patch.dict(SUPPORTED_TOOLKITS, {"unconfigured": unconfigured}), \
             self.assertRaises(ConnectorError) as caught:
            await self.service.create_auth_link(PHONE, "unconfigured")
        self.assertEqual(caught.exception.status_code, 503)

    async def test_callback_origin_is_restricted(self):
        with self.assertRaises(ConnectorError):
            await self.service.create_auth_link(PHONE, "todoist", "https://attacker.test/return")
        self.assertEqual(self.requests, [])

    async def test_discovery_uses_supported_toolkit_and_explicit_version(self):
        await self.service.list_tools("todoist", query="contact")
        request = self.requests[-1]
        self.assertEqual(request.url.params["toolkit_slug"], "todoist")
        self.assertEqual(request.url.params["toolkit_versions"], "latest")

    async def test_run_preview_does_not_execute_and_is_owner_scoped(self):
        run = await self.make_run()
        self.assertEqual(run["status"], "awaiting_approval")
        self.assertFalse(any("/execute/" in r.url.path for r in self.requests))
        with self.assertRaises(ConnectorError) as caught:
            await self.runs.get(OTHER, run["id"])
        self.assertEqual(caught.exception.status_code, 404)

    async def test_duplicate_request_and_approval_execute_only_once(self):
        run = await self.make_run()
        self.assertEqual((await self.make_run())["id"], run["id"])
        result = await self.runs.approve(PHONE, run["id"])
        self.assertEqual(result["status"], "succeeded")
        await self.runs.approve(PHONE, run["id"])
        calls = [r for r in self.requests if "/execute/" in r.url.path]
        self.assertEqual(len(calls), 1)
        self.assertEqual(json.loads(calls[0].content), {
            "user_id": entity_id_for_phone(PHONE), "connected_account_id": "ca_mine",
            "version": "20261029_00", "arguments": {"email": "founder@example.test"},
        })

    async def test_idempotency_key_cannot_hide_changed_arguments(self):
        await self.make_run()
        with self.assertRaises(ConnectorError) as caught:
            await self.runs.create(PHONE, "todoist", "TODOIST_CREATE_TASK", {}, "one")
        self.assertEqual(caught.exception.status_code, 409)

    async def test_http_200_tool_failure_is_stored_as_failed(self):
        self.execution = {"successful": False, "data": {}, "error": "invalid contact"}
        run = await self.make_run()
        self.assertEqual((await self.runs.approve(PHONE, run["id"]))["status"], "failed")

    async def test_timeout_is_unknown_and_never_automatically_retried(self):
        self.timeout = True
        run = await self.make_run()
        self.assertEqual((await self.runs.approve(PHONE, run["id"]))["status"], "unknown")
        await self.runs.approve(PHONE, run["id"])
        self.assertEqual(sum("/execute/" in r.url.path for r in self.requests), 1)

    async def test_connection_replacement_requires_a_new_preview(self):
        run = await self.make_run()
        self.account["id"] = "ca_replaced"
        self.assertEqual((await self.runs.approve(PHONE, run["id"]))["status"], "failed")
        self.assertFalse(any("/execute/" in r.url.path for r in self.requests))

    async def test_cancel_prevents_execution(self):
        run = await self.make_run()
        self.assertEqual((await self.runs.cancel(PHONE, run["id"]))["status"], "cancelled")
        self.assertEqual((await self.runs.approve(PHONE, run["id"]))["status"], "cancelled")
        self.assertFalse(any("/execute/" in r.url.path for r in self.requests))

    async def test_concurrent_approvals_claim_one_execution(self):
        run = await self.make_run()
        await asyncio.gather(*(self.runs.approve(PHONE, run["id"]) for _ in range(4)))
        self.assertEqual(sum("/execute/" in r.url.path for r in self.requests), 1)

    async def test_provider_500_is_unknown_and_not_retried(self):
        self.provider_status = 500
        run = await self.make_run()
        self.assertEqual((await self.runs.approve(PHONE, run["id"]))["status"], "unknown")
        await self.runs.approve(PHONE, run["id"])
        self.assertEqual(sum("/execute/" in r.url.path for r in self.requests), 1)

    async def test_tool_from_another_toolkit_is_rejected(self):
        with self.assertRaises(ConnectorError):
            await self.runs.create(PHONE, "todoist", "GMAIL_SEND_EMAIL", {}, "foreign-tool")

    async def test_disconnect_deletes_only_owned_account(self):
        await self.service.disconnect(PHONE, "todoist")
        calls = [r for r in self.requests if r.method == "DELETE"]
        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0].url.path.endswith("/ca_mine"))
        with self.assertRaises(ConnectorError):
            await self.service.get_active_connection(PHONE, "todoist")

    async def test_foreign_account_cannot_be_disconnected(self):
        self.account["user_id"] = entity_id_for_phone(OTHER)
        with self.assertRaises(ConnectorError):
            await self.service.disconnect(PHONE, "todoist")
        self.assertFalse(any(r.method == "DELETE" for r in self.requests))

    async def test_provider_outage_cannot_confirm_a_cached_active_account(self):
        with patch.object(self.service, "_request", AsyncMock(side_effect=ConnectorError("Unavailable", 503))):
            result = await self.service.mark_connected(PHONE, "todoist")
            self.assertEqual(result["status"], "unknown")
            self.assertFalse(result["newly_active"])
