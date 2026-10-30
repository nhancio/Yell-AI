"""Google Gemini API wrapper for LLM calls."""

import asyncio
import json
import logging
from typing import Any, Optional

import google.generativeai as genai

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

FALLBACK_RESPONSE = (
    "I am here for you, but I am having a moment. Try again in a bit?"
)


class GeminiService:
    """Wrapper around Google Gemini for text and JSON generation."""

    MODEL_NAME = "gemini-3.8-flash"
    REQUEST_TIMEOUT_SECONDS = 20

    def __init__(self) -> None:
        if settings.GEMINI_API_KEY:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
            except Exception as exc:
                logger.warning("Gemini configure warning: %s", exc)

    def _get_model(self, system_instruction: Optional[str] = None):
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
        return genai.GenerativeModel(
            model_name=self.MODEL_NAME,
            system_instruction=system_instruction if system_instruction else None,
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
        """Call Gemini and return the generated text."""
        try:
            contents: list[dict[str, Any]] = []
            if history:
                for turn in history:
                    contents.append(
                        {
                            "role": turn.get("role", "user"),
                            "parts": [{"text": turn.get("content", "")}],
                        }
                    )
            contents.append({"role": "user", "parts": [{"text": user_message}]})

            model = self._get_model(system_instruction=system_prompt)
            async with asyncio.timeout(self.REQUEST_TIMEOUT_SECONDS):
                response = await model.generate_content_async(
                    contents,
                    request_options={"timeout": self.REQUEST_TIMEOUT_SECONDS, "retry": None},
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
        """Call Gemini expecting a JSON response. Parses and returns dict."""
        raw = await self.generate_response(system_prompt, user_message, history)

        cleaned = raw.strip()
        if cleaned.startswith("```"):
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
