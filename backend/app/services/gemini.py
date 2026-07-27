"""Google Gemini API wrapper for LLM calls."""

import json
import logging
from typing import Any, Optional

import google.generativeai as genai

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Configure the SDK once at module level
genai.configure(api_key=settings.GEMINI_API_KEY)

FALLBACK_RESPONSE = (
    "I'm here for you, but I'm having a moment. Try again in a bit?"
)


class GeminiService:
    """Thin wrapper around Gemini 2.0 Flash for text generation."""

    MODEL_NAME = "gemini-2.0-flash"

    def __init__(self) -> None:
        self.model = genai.GenerativeModel(
            model_name=self.MODEL_NAME,
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                top_p=0.95,
                max_output_tokens=1024,
            ),
        )

    async def generate_response(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[list[dict[str, str]]] = None,
    ) -> str:
        """Call Gemini and return the generated text.

        Args:
            system_prompt: Instructions that set agent behaviour.
            user_message: The latest message from the user.
            history: Optional prior conversation turns as
                     [{"role": "user"/"model", "parts": [text]}, ...].

        Returns:
            Generated text, or a friendly fallback on failure.
        """
        try:
            # Build the chat-style content list
            contents: list[dict[str, Any]] = []

            # Prior turns
            if history:
                for turn in history:
                    contents.append(
                        {
                            "role": turn.get("role", "user"),
                            "parts": [{"text": turn.get("content", "")}],
                        }
                    )

            # Current user message
            contents.append({"role": "user", "parts": [{"text": user_message}]})

            response = self.model.generate_content(
                contents,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    top_p=0.95,
                    max_output_tokens=1024,
                ),
                system_instruction=system_prompt,
            )

            text = response.text.strip() if response.text else FALLBACK_RESPONSE
            return text

        except Exception as exc:
            logger.error("Gemini API error: %s", exc, exc_info=True)
            return FALLBACK_RESPONSE

    async def generate_json_response(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[list[dict[str, str]]] = None,
    ) -> dict[str, Any]:
        """Call Gemini expecting a JSON response. Parses and returns dict.

        Falls back to an empty dict on parse failure.
        """
        raw = await self.generate_response(system_prompt, user_message, history)

        # Strip markdown code fences if Gemini wraps the JSON
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            # Remove opening fence (possibly ```json)
            first_newline = cleaned.index("\n") if "\n" in cleaned else 3
            cleaned = cleaned[first_newline + 1 :]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("Failed to parse Gemini JSON response: %s", raw[:200])
            return {}
