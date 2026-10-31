"""Keep receipt feedback fast and keep slow dependencies off the event loop."""

import asyncio
import hashlib
import hmac
import json
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI

from app.agents import AgentOrchestrator
from app.routes import webhook
from app.services import memory as memory_module
from app.services.gemini import FALLBACK_RESPONSE, GeminiService
from app.services.memory import MemoryService, MemoryUnavailable
from app.services.whatsapp import WhatsAppService


class TypingIndicatorTests(unittest.IsolatedAsyncioTestCase):
    async def test_native_typing_payload_and_read_receipt_share_one_request(self):
        requests = []

        def handle(request):
            requests.append(json.loads(request.content))
            return httpx.Response(200, json={"success": True})

        real_client = httpx.AsyncClient
        transport = httpx.MockTransport(handle)
        service = WhatsAppService()
        indicator = getattr(service, "send_typing_indicator", None)
        self.assertIsNotNone(indicator, "Native typing feedback is missing")
        with patch("app.services.whatsapp.httpx.AsyncClient",
                   side_effect=lambda **kw: real_client(transport=transport, **kw)):
            self.assertTrue(await indicator("wamid.inbound"))
        self.assertEqual(requests, [{"messaging_product": "whatsapp", "status": "read",
                                    "message_id": "wamid.inbound",
                                    "typing_indicator": {"type": "text"}}])

    async def test_slow_typing_provider_is_bounded(self):
        service = WhatsAppService()
        indicator = getattr(service, "send_typing_indicator", None)
        self.assertIsNotNone(indicator, "Native typing feedback is missing")
        async def stalled_post(*args, **kwargs):
            await asyncio.Event().wait()

        with patch.object(service, "_post", side_effect=stalled_post):
            self.assertFalse(await asyncio.wait_for(indicator("wamid.inbound"), timeout=3))

    async def test_typing_precedes_database_work_and_duplicate_does_not_repeat_it(self):
        events = []

        async def post(payload, **kwargs):
            if "typing_indicator" in payload:
                events.append("typing")
            return {"success": True}

        async def database():
            events.append("database")
            raise RuntimeError("offline database")

        async def process(**kwargs):
            events.append("process")

        app = FastAPI()
        app.include_router(webhook.router)
        body = json.dumps({"entry": [{"changes": [{"value": {"messages": [{
            "id": "wamid.feedback-order", "from": "919876543210", "type": "text",
            "text": {"body": "hello"}}]}}]}]}).encode()
        signature = "sha256=" + hmac.new(b"latency-test", body, hashlib.sha256).hexdigest()
        with patch.object(webhook.settings, "WHATSAPP_APP_SECRET", "latency-test"), \
             patch.object(webhook, "PROCESSED_MESSAGE_IDS", {}), \
             patch.object(webhook.whatsapp, "_post", side_effect=post), \
             patch.object(webhook, "ensure_tables", side_effect=database), \
             patch.object(webhook, "process_user_message", side_effect=process):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                first = await client.post("/webhook", content=body, headers={"X-Hub-Signature-256": signature})
                second = await client.post("/webhook", content=body, headers={"X-Hub-Signature-256": signature})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.json()["status"], "already_processed")
        self.assertEqual(events, ["typing", "database", "process"])


class MemoryRetryTests(unittest.IsolatedAsyncioTestCase):
    async def test_outage_uses_one_probe_then_recovers_after_cooldown(self):
        clock, attempts = [100.0], []

        class Redis:
            async def ping(self):
                if len(attempts) == 1:
                    raise ConnectionError("offline")
                return True

            async def aclose(self):
                pass

            async def lrange(self, *args):
                return []

        def connect(*args, **kwargs):
            attempts.append(clock[0])
            return Redis()

        service = MemoryService()
        with patch.dict(memory_module.settings.__dict__, ENVIRONMENT="development", ALLOW_MEMORY_FALLBACK=True), \
             patch.object(memory_module.aioredis, "from_url", side_effect=connect), \
             patch.object(memory_module, "time", SimpleNamespace(monotonic=lambda: clock[0], time=lambda: 1000.0), create=True):
            await service.add_message("919876543210", "user", "hello")
            histories = await asyncio.gather(*(service.get_conversation_history("919876543210") for _ in range(3)))
            self.assertEqual(histories, [[{"role": "user", "content": "hello"}]] * 3)
            self.assertEqual(attempts, [100.0], "Every operation retried an unavailable dependency")
            clock[0] = 131.0
            self.assertEqual(await service.get_conversation_history("919876543210"), [])
            self.assertEqual(attempts, [100.0, 131.0])
        await service.close()

    async def test_production_outage_still_refuses_local_memory_during_cooldown(self):
        client = SimpleNamespace(ping=AsyncMock(side_effect=ConnectionError), aclose=AsyncMock())
        service = MemoryService()
        with patch.dict(memory_module.settings.__dict__, ENVIRONMENT="production"), \
             patch.object(memory_module.aioredis, "from_url", return_value=client):
            for _ in range(2):
                with self.assertRaises(MemoryUnavailable):
                    await service.get_conversation_history("919876543210")


class AsyncGeminiTests(unittest.IsolatedAsyncioTestCase):
    async def test_generation_yields_instead_of_blocking_other_requests(self):
        release = asyncio.Event()

        async def generate(*args):
            await release.wait()
            return "Astra response"

        service = GeminiService()
        with patch.object(service, "_generate", side_effect=generate):
            task = asyncio.create_task(service.generate_response("system", "hello"))
            try:
                await asyncio.sleep(0)
                self.assertFalse(task.done(), "Generation blocks message handling")
            finally:
                release.set()
                result = await task
        self.assertEqual(result, "Astra response")

    async def test_generation_timeout_returns_fallback(self):
        async def stalled_generation(*args, **kwargs):
            await asyncio.Event().wait()

        with patch.object(GeminiService, "_generate", side_effect=stalled_generation), \
             patch.object(GeminiService, "REQUEST_TIMEOUT_SECONDS", 0.01):
            self.assertEqual(await asyncio.wait_for(
                GeminiService().generate_response("system", "hello"), timeout=0.5), FALLBACK_RESPONSE)

    async def test_router_picks_model_and_thinking_level_and_maps_roles(self):
        requests = []

        def handle(request):
            requests.append((request.url.path, json.loads(request.content)))
            return httpx.Response(200, json={"candidates": [{"content": {"parts": [
                {"text": "thinking...", "thought": True}, {"text": '{"ok": true}'}]}}]})

        real_client = httpx.AsyncClient
        transport = httpx.MockTransport(handle)
        service = GeminiService()
        history = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hey"}]
        with patch("app.services.gemini.httpx.AsyncClient",
                   side_effect=lambda **kw: real_client(transport=transport, **kw)):
            self.assertEqual(await service.generate_json_response("classify", "remind me"), {"ok": True})
            self.assertEqual(await service.generate_response("answer", "remind me", history), '{"ok": true}')

        (fast_path, fast), (main_path, main) = requests
        self.assertIn("gemini-3.1-flash-lite:", fast_path)
        self.assertEqual(fast["generationConfig"]["thinkingConfig"], {"thinkingLevel": "minimal"})
        self.assertEqual(fast["generationConfig"]["responseMimeType"], "application/json")
        self.assertIn("gemini-3.8-flash:", main_path)
        self.assertEqual(main["generationConfig"]["thinkingConfig"], {"thinkingLevel": "low"})
        self.assertEqual([c["role"] for c in main["contents"]], ["user", "model", "user"])

    async def test_orchestrator_routes_simple_tasks_to_flash_lite_and_complex_to_flash(self):
        requests = []

        def handle(request):
            body = json.loads(request.content)
            requests.append((request.url.path, body))
            if body["generationConfig"].get("responseMimeType") == "application/json":
                is_complex = "Founder" in body["contents"][-1]["parts"][0]["text"]
                payload = {
                    "emotion": "neutral",
                    "empathy_response": "Got it.",
                    "needs_action": True,
                    "is_crisis": False,
                    "complex": is_complex,
                    "intent": "founder_outreach" if is_complex else "general_help",
                    "required_toolkit": None,
                    "details": {"summary": "test", "key_points": []},
                }
                text = json.dumps(payload)
            else:
                text = "Here is your answer."
            return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})

        real_client = httpx.AsyncClient
        transport = httpx.MockTransport(handle)
        orchestrator = AgentOrchestrator(GeminiService())
        with patch("app.services.gemini.httpx.AsyncClient",
                   side_effect=lambda **kw: real_client(transport=transport, **kw)):
            await orchestrator.process("What is the capital of Karnataka?")
            await orchestrator.process("Founder cold email for a YC fintech role")

        # 1st message: router (3.1 Flash-Lite JSON) + simple task answer (3.5 Flash-Lite plain text)
        self.assertIn("gemini-3.1-flash-lite:", requests[0][0])
        self.assertEqual(requests[0][1]["generationConfig"].get("responseMimeType"), "application/json")
        self.assertIn("gemini-3.5-flash-lite:", requests[1][0])
        self.assertIsNone(requests[1][1]["generationConfig"].get("responseMimeType"))
        # 2nd message: router (3.1 Flash-Lite JSON) + complex task answer (Flash plain text)
        self.assertIn("gemini-3.1-flash-lite:", requests[2][0])
        self.assertIn("gemini-3.8-flash:", requests[3][0])
        self.assertEqual(requests[3][1]["generationConfig"]["thinkingConfig"], {"thinkingLevel": "low"})

