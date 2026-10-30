"""Intent classification agent — maps user message to job-outreach service intents."""

import logging
from typing import Any

from app.services.gemini import GeminiService

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the intent classifier for Yell AI — a job-outreach service for job seekers in India. Yell AI helps users land interviews at startups by drafting and sending personal cold emails to founders from the user's own Gmail.

Given a user's message and their detected emotion, classify what they want done.

Available intents:
- founder_outreach: User wants to cold email startup founders, find Indian/YC startups to target, or get referrals
- gmail_action: User wants to send, follow up on, or check replies to outreach emails in their Gmail
- calendar_action: User wants to schedule or track an interview in Google Calendar
- email_draft: User wants help writing a job-related email or message without sending it
- job_search: User wants job hunting help (which roles/companies to target, Naukri, Instahyre, LinkedIn) or interview prep
- resume_help: User wants resume/CV improvement or LinkedIn profile optimization
- coping_strategies: User is stressed or anxious about the job hunt and needs support
- general_help: Anything else, including requests unrelated to job hunting
- just_venting: User is just expressing feelings and doesn't need a task done

Also identify if a Composio connector toolkit is needed ("gmail", "googlecalendar", "linkedin", or null).

Return ONLY valid JSON:
{
  "intent": "one_of_the_above_intents",
  "required_toolkit": "gmail|googlecalendar|linkedin|null",
  "details": {
    "summary": "brief summary of what they need",
    "key_points": ["point1", "point2"]
  }
}"""


class IntentAgent:
    def __init__(self, gemini: GeminiService) -> None:
        self.gemini = gemini

    async def classify(
        self, message: str, emotion: str
    ) -> dict[str, Any]:
        enriched_message = f"[User emotion: {emotion}]\n\nUser message: {message}"

        result = await self.gemini.generate_json_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=enriched_message,
        )

        if not result:
            return {
                "intent": "general_help",
                "required_toolkit": None,
                "details": {"summary": message[:100], "key_points": []},
            }

        intent = result.get("intent", "general_help")
        valid_intents = {
            "founder_outreach",
            "gmail_action",
            "calendar_action",
            "email_draft",
            "job_search",
            "resume_help",
            "coping_strategies",
            "general_help",
            "just_venting",
        }
        if intent not in valid_intents:
            intent = "general_help"

        req_tk = result.get("required_toolkit")
        if req_tk in ("null", "None", ""):
            req_tk = None

        return {
            "intent": intent,
            "required_toolkit": req_tk,
            "details": result.get("details", {}),
        }
