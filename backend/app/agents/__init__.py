"""Agent orchestration — emotion → intent → Composio connector check → task routing."""

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

from app.agents.emotion import EmotionAgent
from app.agents.intent import IntentAgent
from app.agents.tasks import TaskAgentRouter
from app.services.gemini import GeminiService

logger = logging.getLogger(__name__)


@dataclass
class AgentResult:
    emotion: str
    intent: str
    empathy_response: str
    task_response: str | None
    full_response: str
    is_crisis: bool = False
    required_toolkit: Optional[str] = None


class AgentOrchestrator:
    """Runs the full pipeline: emotion → intent → task agent + Composio toolkit detection."""

    def __init__(self, gemini: GeminiService) -> None:
        self.emotion_agent = EmotionAgent(gemini)
        self.intent_agent = IntentAgent(gemini)
        self.task_router = TaskAgentRouter(gemini)

    async def process(
        self,
        message: str,
        history: list[dict] | None = None,
        connected_apps: list[str] | None = None,
    ) -> AgentResult:
        history = history or []
        connected_apps = connected_apps or []

        # Step 1 — Emotion and intent run concurrently on the fast model (the intent call is
        # wasted for venting/crisis messages; a cheap Flash-Lite call buys ~1s per reply).
        emotion_result, intent_result = await asyncio.gather(
            self.emotion_agent.detect_and_respond(message, history),
            self.intent_agent.classify(message),
        )
        logger.info("Emotion: %s | needs_action: %s", emotion_result["emotion"], emotion_result["needs_action"])

        # Crisis check — immediate return with helpline info
        if emotion_result.get("is_crisis"):
            crisis_response = (
                f"{emotion_result['empathy_response']}\n\n"
                "🆘 *Please reach out — you don't have to face this alone:*\n"
                "• iCall: 9152987821\n"
                "• Vandrevala Foundation: 1860-2662-345\n"
                "• AASRA: 9820466726\n\n"
                "I'm here whenever you need to talk. 💛"
            )
            return AgentResult(
                emotion=emotion_result["emotion"],
                intent="crisis",
                empathy_response=emotion_result["empathy_response"],
                task_response=None,
                full_response=crisis_response,
                is_crisis=True,
            )

        # If user just needs to vent, return empathy only
        if not emotion_result["needs_action"]:
            return AgentResult(
                emotion=emotion_result["emotion"],
                intent="just_venting",
                empathy_response=emotion_result["empathy_response"],
                task_response=None,
                full_response=emotion_result["empathy_response"],
            )

        # Step 2 — Intent classification (already computed above)
        intent = intent_result["intent"]
        required_toolkit = intent_result.get("required_toolkit")
        logger.info("Intent: %s | required_toolkit: %s", intent, required_toolkit)

        # Step 3 — Route to task agent
        task_response = await self.task_router.route(
            intent=intent,
            details=intent_result.get("details", {}),
            context=message,
            emotion=emotion_result["emotion"],
            history=history,
            connected_apps=connected_apps,
        )

        # Intelligent synthesis: Avoid repeating duplicate answers!
        # If task_response already answers the question, DO NOT double-reply with empathy_response.
        if task_response:
            # Only prepend empathy if user is genuinely distressed/angry/stressed
            if emotion_result.get("emotion") in ("anger", "stress", "sadness", "frustration", "anxiety"):
                full_response = f"{emotion_result['empathy_response']}\n\n{task_response}".strip()
            else:
                full_response = task_response.strip()
        else:
            full_response = emotion_result.get("empathy_response", "").strip()

        return AgentResult(
            emotion=emotion_result["emotion"],
            intent=intent,
            empathy_response=emotion_result["empathy_response"],
            task_response=task_response,
            full_response=full_response,
            required_toolkit=required_toolkit,
        )
