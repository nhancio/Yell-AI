"""App actions from WhatsApp: pick one, preview it, and run it only after the owner replies YES."""

import logging
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.services.composio_service import SUPPORTED_TOOLKITS, ConnectorError
from app.services.gemini import GeminiService
from app.services.memory import memory_service as memory
from app.services.tool_runs import ToolRunService

logger = logging.getLogger(__name__)

# ponytail: four hand-picked write actions; add reads (inbox, agenda) once these prove out.
ACTIONS: dict[str, dict[str, Any]] = {
    "gmail": {
        "tool": "GMAIL_SEND_EMAIL", "ask": "Send this email?", "done": "Email sent",
        "fields": {"recipient_email": "recipient's email address, exactly as the user wrote it",
                   "subject": "short subject line", "body": "plain-text email body, ready to send"},
        "fixed": {},
    },
    "googlecalendar": {
        "tool": "GOOGLECALENDAR_CREATE_EVENT", "ask": "Add this to your Google Calendar?", "done": "Event added",
        "fields": {"summary": "event title",
                   "start_datetime": "start as YYYY-MM-DDTHH:MM:SS in India time, no offset",
                   "event_duration_hour": "whole hours (integer, default 0)",
                   "event_duration_minutes": "extra minutes 0-59 (integer, default 30 if no duration given)",
                   "attendees": "list of attendee email addresses the user wrote, else []"},
        "fixed": {"timezone": "Asia/Kolkata"},
    },
    "todoist": {
        "tool": "TODOIST_CREATE_TASK", "ask": "Add this task to Todoist?", "done": "Task added",
        "fields": {"content": "task title", "due_string": "due date in plain English, e.g. 'tomorrow 6pm', else ''"},
        "fixed": {},
    },
    "googletasks": {
        "tool": "GOOGLETASKS_INSERT_TASK", "ask": "Add this to Google Tasks?", "done": "Task added",
        "fields": {"title": "task title", "notes": "short notes, else ''"},
        "fixed": {"tasklist_id": "@default", "status": "needsAction"},
    },
}
YES = {"yes", "y", "haan", "ha", "han", "ok", "okay", "send", "confirm", "do it", "go ahead", "👍"}
NO = {"no", "n", "nahi", "nah", "cancel", "stop", "don't", "dont"}
PENDING_TTL = 30 * 60


def _key(phone: str) -> str:
    return f"astra:pending_run:{phone}"


def connect_hint(toolkit: str, url: str) -> str:
    """Honest nudge: linking these apps really does let Astra act, after a YES."""
    if toolkit not in ACTIONS:
        return ""
    name = SUPPORTED_TOOLKITS[toolkit]["name"]
    return f"\n\n🔗 Link {name} at {url} and I can do this for you after you reply YES."


class ChatActions:
    def __init__(self, gemini: GeminiService, runs: ToolRunService):
        self.gemini = gemini
        self.runs = runs

    async def resolve_pending(self, phone: str, clean_text: str) -> str | None:
        """YES runs the pending action, NO cancels it; any other message cancels it silently."""
        run_id = await memory.pop_value(_key(phone))
        if not run_id:
            return None
        try:
            if clean_text in YES:
                run = await self.runs.approve(phone, run_id)
                meta = ACTIONS.get(run["toolkit"], {})
                if run["status"] == "succeeded":
                    return f"✅ {meta.get('done', 'Done')}."
                if run["status"] == "unknown":
                    return (f"⚠️ I couldn't confirm whether that went through. Please check "
                            f"{SUPPORTED_TOOLKITS[run['toolkit']]['name']} before trying again.")
                return "⚠️ That didn't go through. Nothing was changed. Want to try again?"
            await self.runs.cancel(phone, run_id)
        except ConnectorError as exc:
            logger.warning("Pending action %s could not be resolved: %s", run_id, exc)
            if clean_text in YES:
                return "⚠️ That action expired or the app was disconnected. Please ask again."
        return "Cancelled. Nothing was sent." if clean_text in NO else None

    async def propose(self, phone: str, text: str, active_apps: list[str], message_id: str,
                      history: list[dict] | None = None) -> str | None:
        """Returns a preview (or a question for a missing detail), or None to answer normally."""
        usable = [slug for slug in ACTIONS if slug in active_apps]
        if not usable:
            return None
        now = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%A %d %B %Y, %H:%M")
        catalogue = "\n".join(
            f'- "{slug}" ({ACTIONS[slug]["ask"]}) fields: ' +
            "; ".join(f"{k}: {v}" for k, v in ACTIONS[slug]["fields"].items()) for slug in usable)
        system = f"""You decide whether a WhatsApp message asks Astra to actually perform one app action now.
It is {now} in India.
Available actions:
{catalogue}
Rules:
- Only act when the user clearly wants it done in the app (send, schedule, add, remind). If they only want a draft, advice or an answer, act is false.
- Never invent email addresses, people or dates. If they want it done but a detail is missing (e.g. no email address), act is true and missing is one short question asking for it.
Return ONLY JSON: {{"act": true|false, "toolkit": "<slug or empty>", "missing": "<question or empty>", "arguments": {{...fields...}}}}"""
        # Recent turns let a follow-up ("priya@acme.com") complete an earlier request.
        plan = await self.gemini.generate_json_response(system, text, (history or [])[-6:])
        toolkit = plan.get("toolkit")
        if not plan.get("act") or toolkit not in usable:
            return None
        if plan.get("missing"):
            return str(plan["missing"])[:300]
        meta = ACTIONS[toolkit]
        args = {k: v for k, v in (plan.get("arguments") or {}).items() if k in meta["fields"] and v not in ("", None)}
        args |= meta["fixed"]
        try:
            run = await self.runs.create(phone, toolkit, meta["tool"], args, f"wa:{message_id}")
        except ConnectorError as exc:
            logger.warning("Could not preview %s for %s: %s", meta["tool"], phone, exc)
            return f"⚠️ I couldn't reach {SUPPORTED_TOOLKITS[toolkit]['name']} right now. Try again in a bit?"
        await memory.set_value(_key(phone), run["id"], PENDING_TTL)
        lines = "\n".join(f"• *{k.replace('_', ' ').title()}:* {v}" for k, v in args.items()
                          if k in meta["fields"] and v not in ([], 0))
        return f"*{meta['ask']}*\n{lines}\n\nReply *YES* to go ahead or *NO* to cancel."
