"""Single router call: emotion, crisis check and intent in one Flash-Lite request (was two calls)."""

import logging
from typing import Any

from app.services.composio_service import SUPPORTED_TOOLKITS
from app.services.gemini import GeminiService

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the router for Astra AI, a WhatsApp assistant for India. For each message, read the feelings and the request.

Emotion:
- Detect the user's primary emotion.
- Write a warm, human, non-judgmental empathy line: 1 short sentence, under 120 characters, in the user's language (Hindi, English, Hinglish, Telugu, Tamil). Sound like a caring friend, never start with "I understand", at most 1-2 emojis, stay calm if they are abusive.
- needs_action = true when they want something done (solve, draft, find, plan); false when they only want to vent or talk.
- is_crisis = true ONLY for suicidal ideation, self-harm, or extreme hopelessness ("I want to end it all", "life is not worth living").

Intent: classify what they want done.

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

Also identify if a Composio connector toolkit is needed (one of: {TOOLKITS}; or null), and set complex = true ONLY when the reply needs deep reasoning, code, financial/tax math, resume rewriting, cold outreach, or multi-step analysis (false for everyday questions, quick facts, casual advice, or simple tasks).

Return ONLY valid JSON:
{
  "emotion": "anger|stress|sadness|frustration|confusion|anxiety|joy|neutral",
  "empathy_response": "your warm line",
  "needs_action": true/false,
  "is_crisis": true/false,
  "complex": true/false,
  "intent": "one_of_the_above_intents",
  "required_toolkit": "one toolkit slug from the list above, or null",
  "details": {
    "summary": "brief summary of what they need",
    "key_points": ["point1", "point2"]
  }
}""".replace("{TOOLKITS}", ", ".join(SUPPORTED_TOOLKITS))


class IntentAgent:
    def __init__(self, gemini: GeminiService) -> None:
        self.gemini = gemini

    async def classify(
        self, message: str, history: list[dict] | None = None
    ) -> dict[str, Any]:
        result = await self.gemini.generate_json_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=message,
            history=history,
        )

        # Parse failure: answer the request rather than only sympathising.
        empathy = result.get("empathy_response") or "I hear you. Tell me more. 💛"
        feelings = {
            "emotion": result.get("emotion", "neutral"),
            "empathy_response": empathy,
            "needs_action": bool(result.get("needs_action", True)),
            "is_crisis": bool(result.get("is_crisis", False)),
            "complex": bool(result.get("complex", False)),
        }
        if not result:
            return feelings | {
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

        return feelings | {
            "intent": intent,
            "required_toolkit": req_tk,
            "details": result.get("details", {}),
        }
