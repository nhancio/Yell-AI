"""Intent classification agent — maps user message to India Life-OS & Composio tool intents."""

import logging
from typing import Any

from app.services.gemini import GeminiService

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the intent classifier for Astra AI — India's #1 WhatsApp AI Super-Agent (like Instinct + Poke + Backdoor built for India).

Given a user's message, classify what they want done.

Available intents:
- gmail_action: User wants to read, search, draft, or send an email in Gmail
- calendar_action: User wants to check schedule, book a meeting, set a reminder, or create a Google Calendar event
- notion_action: User wants to save notes, update a Notion page, or manage workspace docs
- founder_outreach: User wants "Backdoor" style hiring help — cold emailing startup founders, finding YC/Indian startup roles, or referrals
- travel_irctc: User asks about flights, hotels, travel itineraries, or trip planning
- food_commerce: User asks about ordering food (Swiggy/Zomato), quick commerce groceries (Blinkit/Zepto/Instamart), or comparing prices on Amazon/Flipkart
- email_draft: User wants help writing a professional email/message without necessarily triggering live Gmail send
- job_search: User wants career change, job hunting help (Naukri, Instahyre, LinkedIn), or interview prep
- task_planning: User needs help organizing daily tasks, routines, or productivity
- resume_help: User wants resume/CV improvement or LinkedIn profile optimization
- budget_planning: User needs personal finance, UPI spend tracking, SIP/mutual fund basics, or tax/budget planning for India
- relationship_advice: User needs advice on partner, family, parents, friends, or workplace politics
- coping_strategies: User needs stress relief, anxiety support, or wellness strategies
- research: User wants deep research, cricket/IPL scores, news, coding help, or product comparisons
- general_help: Anything else that needs action
- just_venting: User is just expressing feelings and doesn't need a task done

Also identify if a Composio connector toolkit is needed ("gmail", "googlecalendar", "notion", "github", "linkedin", "googlesheets", or null).

Return ONLY valid JSON:
{
  "intent": "one_of_the_above_intents",
  "required_toolkit": "gmail|googlecalendar|notion|github|linkedin|googlesheets|null",
  "details": {
    "summary": "brief summary of what they need",
    "key_points": ["point1", "point2"]
  }
}"""


class IntentAgent:
    def __init__(self, gemini: GeminiService) -> None:
        self.gemini = gemini

    async def classify(
        self, message: str
    ) -> dict[str, Any]:
        enriched_message = f"User message: {message}"

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
            "gmail_action",
            "calendar_action",
            "notion_action",
            "founder_outreach",
            "travel_irctc",
            "food_commerce",
            "email_draft",
            "job_search",
            "task_planning",
            "resume_help",
            "budget_planning",
            "relationship_advice",
            "coping_strategies",
            "research",
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
