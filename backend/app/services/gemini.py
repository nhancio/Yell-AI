"""Google Gemini API wrapper for LLM calls (REST, so thinking level is set per call)."""

import asyncio
import json
import logging
from typing import Any, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

FALLBACK_RESPONSE = (
    "I am here for you, but I am having a moment. Try again in a bit?"
)
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiService:
    """Wrapper around Google Gemini for text and JSON generation.

    Model router: classifiers (JSON) run on Flash-Lite with minimal thinking (~0.9s);
    the user-facing answer runs on Flash with low thinking (~1.9s). Flash at its
    default (medium) thinking measured ~3.9s per call. Flash rejects "minimal".
    """

    MODEL_NAME = "gemini-3.8-flash"
    FAST_MODEL_NAME = "gemini-3.5-flash-lite"
    REQUEST_TIMEOUT_SECONDS = 20

    async def _generate(self, model: str, thinking: str, body: dict[str, Any]) -> str:
        body["generationConfig"]["thinkingConfig"] = {"thinkingLevel": thinking}
        async with httpx.AsyncClient(timeout=self.REQUEST_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                API_URL.format(model=model),
                json=body,
                headers={"x-goog-api-key": settings.GEMINI_API_KEY},
            )
        if resp.status_code != 200:
            raise RuntimeError(f"Gemini {model} HTTP {resp.status_code}: {resp.text[:300]}")
        parts = resp.json()["candidates"][0]["content"].get("parts", [])
        return "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()

    async def generate_response(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[list[dict[str, str]]] = None,
        fast: bool = False,
    ) -> str:
        """Call Gemini and return the generated text. `fast` = Flash-Lite, for classification."""
        try:
            contents = [
                {
                    "role": "model" if turn.get("role") == "assistant" else "user",
                    "parts": [{"text": turn.get("content", "")}],
                }
                for turn in history or []
            ]
            contents.append({"role": "user", "parts": [{"text": user_message}]})
            body = {
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": contents,
                "generationConfig": {"temperature": 0.7, "topP": 0.95, "maxOutputTokens": 1024},
            }
            if fast:
                body["generationConfig"]["responseMimeType"] = "application/json"
            model, thinking = (self.FAST_MODEL_NAME, "minimal") if fast else (self.MODEL_NAME, "low")

            async with asyncio.timeout(self.REQUEST_TIMEOUT_SECONDS):
                text = await self._generate(model, thinking, body)
            return text or FALLBACK_RESPONSE

        except Exception as exc:
            logger.error("Gemini API error: %s", exc)
            return FALLBACK_RESPONSE

    async def generate_json_response(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[list[dict[str, str]]] = None,
    ) -> dict[str, Any]:
        """Call Gemini (fast model) expecting a JSON response. Parses and returns dict."""
        raw = await self.generate_response(system_prompt, user_message, history, fast=True)

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
