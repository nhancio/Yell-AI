"""App actions only run after an explicit YES, exactly once, for linked apps."""

import unittest
from unittest.mock import AsyncMock, patch

from app.services import chat_actions as module
from app.services.chat_actions import ChatActions, connect_hint
from app.services.memory import MemoryService

PHONE = "918374548218"
SEND_PLAN = {"act": True, "toolkit": "gmail", "missing": "",
             "arguments": {"recipient_email": "rahul@acme.com", "subject": "Deck update",
                           "body": "The deck moves to Monday.", "invented": "x"}}


class ChatActionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.memory = MemoryService()
        self.patches = [patch.object(self.memory, "_get_redis", AsyncMock(return_value=None)),
                        patch.object(module, "memory", self.memory)]
        for p in self.patches:
            p.start()
        self.gemini = AsyncMock()
        self.runs = AsyncMock()
        self.runs.create.return_value = {"id": "run-1"}
        self.actions = ChatActions(self.gemini, self.runs)

    def tearDown(self):
        for p in self.patches:
            p.stop()

    async def propose(self, plan, apps=("gmail",)):
        self.gemini.generate_json_response.return_value = plan
        return await self.actions.propose(PHONE, "send it", list(apps), "wamid.1")

    async def test_preview_creates_run_and_waits_for_yes(self):
        reply = await self.propose(SEND_PLAN)
        self.runs.create.assert_awaited_once_with(
            PHONE, "gmail", "GMAIL_SEND_EMAIL",
            {"recipient_email": "rahul@acme.com", "subject": "Deck update", "body": "The deck moves to Monday."},
            "wa:wamid.1")
        self.assertIn("Send this email?", reply)
        self.assertIn("rahul@acme.com", reply)
        self.assertIn("Reply *YES*", reply)
        self.runs.approve.assert_not_awaited()

    async def test_yes_runs_once(self):
        await self.propose(SEND_PLAN)
        self.runs.approve.return_value = {"toolkit": "gmail", "status": "succeeded"}
        self.assertEqual(await self.actions.resolve_pending(PHONE, "yes"), "✅ Email sent.")
        self.assertIsNone(await self.actions.resolve_pending(PHONE, "yes"))
        self.runs.approve.assert_awaited_once_with(PHONE, "run-1")

    async def test_no_cancels_and_other_messages_drop_silently(self):
        await self.propose(SEND_PLAN)
        self.assertEqual(await self.actions.resolve_pending(PHONE, "no"), "Cancelled. Nothing was sent.")
        await self.propose(SEND_PLAN)
        self.assertIsNone(await self.actions.resolve_pending(PHONE, "actually make it tuesday"))
        self.assertEqual(self.runs.cancel.await_count, 2)
        self.runs.approve.assert_not_awaited()

    async def test_uncertain_outcome_is_not_reported_as_done(self):
        await self.propose(SEND_PLAN)
        self.runs.approve.return_value = {"toolkit": "gmail", "status": "unknown"}
        self.assertIn("couldn't confirm", await self.actions.resolve_pending(PHONE, "haan"))

    async def test_drafts_missing_details_and_unlinked_apps_do_not_create_runs(self):
        self.assertIsNone(await self.propose({"act": False}))
        self.assertEqual(await self.propose({**SEND_PLAN, "missing": "What is Rahul's email?"}),
                         "What is Rahul's email?")
        self.assertIsNone(await self.propose(SEND_PLAN, apps=("todoist",)))
        self.assertIsNone(await self.propose(SEND_PLAN, apps=()))
        self.runs.create.assert_not_awaited()

    def test_connect_hint_only_for_actionable_apps(self):
        self.assertIn("Link Gmail", connect_hint("gmail", "https://t"))
        self.assertEqual(connect_hint("notion", "https://t"), "")


if __name__ == "__main__":
    unittest.main()
