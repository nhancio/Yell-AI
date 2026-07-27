"""Intent classification agent — maps user message to an actionable intent."""

import logging
from typing import Any

from app.services.gemini import GeminiService

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the intent classifier for Yell AI. Given a user's message and their detected emotion, determine what kind of help they need.

Available intents:
- email_draft: User wants help writing an email (to boss, colleague, client, etc.)
- job_search: User wants career change, job hunting help, or exploring opportunities
- task_planning: User needs help organizing tasks, scheduling, or prioritizing work
- resume_help: User wants resume/CV improvement or LinkedIn profile help
- budget_planning: User needs financial planning, budgeting, or money management help
- relationship_advice: User needs help with interpersonal issues (partner, family, friends, colleagues)
- coping_strategies: User needs mental health coping strategies, stress management, or wellness tips
- general_help: Anything else that needs action but doesn't fit above categories
- just_venting: User is just expressing feelings and doesn't need any task done

Return ONLY valid JSON:
{
  "intent": "one_of_the_above_intents",
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
                "details": {"summary": message[:100], "key_points": []},
            }

        intent = result.get("intent", "general_help")

        # Validate intent is one of the known values
        valid_intents = {
            "email_draft",
            "job_search",
            "task_planning",
            "resume_help",
            "budget_planning",
            "relationship_advice",
            "coping_strategies",
            "general_help",
            "just_venting",
        }
        if intent not in valid_intents:
            intent = "general_help"

        return {
            "intent": intent,
            "details": result.get("details", {}),
        }
