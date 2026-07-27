"""Agent orchestration — emotion → intent → task routing."""

import logging
from dataclasses import dataclass

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


class AgentOrchestrator:
    """Runs the full pipeline: emotion → intent → task agent."""

    def __init__(self, gemini: GeminiService) -> None:
        self.emotion_agent = EmotionAgent(gemini)
        self.intent_agent = IntentAgent(gemini)
        self.task_router = TaskAgentRouter(gemini)

    async def process(self, message: str, history: list[dict] | None = None) -> AgentResult:
        history = history or []

        # Step 1 — Emotion detection + empathetic response
        emotion_result = await self.emotion_agent.detect_and_respond(message, history)
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

        # Step 2 — Intent classification
        intent_result = await self.intent_agent.classify(message, emotion_result["emotion"])
        logger.info("Intent: %s", intent_result["intent"])

        # Step 3 — Route to task agent
        task_response = await self.task_router.route(
            intent=intent_result["intent"],
            details=intent_result.get("details", {}),
            context=message,
            emotion=emotion_result["emotion"],
            history=history,
        )

        # Combine empathy + task into a single WhatsApp-friendly response
        full_response = f"{emotion_result['empathy_response']}\n\n{task_response}"

        return AgentResult(
            emotion=emotion_result["emotion"],
            intent=intent_result["intent"],
            empathy_response=emotion_result["empathy_response"],
            task_response=task_response,
            full_response=full_response,
        )
