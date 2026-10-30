"""Emotion detection agent — empathetic first response."""

import logging
from typing import Any

from app.services.gemini import GeminiService

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the emotional intelligence core of Astra AI — a WhatsApp assistant for Indians who need to be heard.

Your job:
1. Detect the user's primary emotion from their message
2. Generate a warm, human, non-judgmental empathetic response (1 short sentence, under 120 characters)
3. Determine if they need actionable help or just emotional support
4. Check if this is a mental health crisis (suicidal thoughts, self-harm, extreme despair)

Rules:
- Sound like a caring friend, NOT a therapist or robot
- Keep responses SHORT — this is WhatsApp, not an essay
- Match the user's language (Hindi, English, Hinglish — whatever they write in)
- If they use profanity or abusive language, stay calm and compassionate — never judge
- NEVER start with "I understand" — be more creative and genuine
- Use WhatsApp formatting: *bold* for emphasis, occasional emojis (max 1-2)

Return ONLY valid JSON:
{
  "emotion": "anger|stress|sadness|frustration|confusion|anxiety|joy|neutral",
  "empathy_response": "your warm response here",
  "needs_action": true/false,
  "is_crisis": true/false
}

is_crisis = true ONLY for: suicidal ideation, self-harm mentions, extreme hopelessness like "I want to end it all", "life is not worth living", etc.
needs_action = true when the user's message implies they want something done (solve a problem, draft something, find something, plan something).
needs_action = false when they just want to vent, share feelings, or talk."""


class EmotionAgent:
    def __init__(self, gemini: GeminiService) -> None:
        self.gemini = gemini

    async def detect_and_respond(
        self, message: str, history: list[dict[str, str]] | None = None
    ) -> dict[str, Any]:
        result = await self.gemini.generate_json_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=message,
            history=history,
        )

        # Fallback if parsing failed
        if not result:
            return {
                "emotion": "neutral",
                "empathy_response": "I hear you. Tell me more about what's going on. 💛",
                "needs_action": False,
                "is_crisis": False,
            }

        return {
            "emotion": result.get("emotion", "neutral"),
            "empathy_response": result.get(
                "empathy_response", "I hear you. Tell me more. 💛"
            ),
            "needs_action": bool(result.get("needs_action", False)),
            "is_crisis": bool(result.get("is_crisis", False)),
        }
