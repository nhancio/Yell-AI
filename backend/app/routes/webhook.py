"""WhatsApp webhook — receives and processes incoming messages."""

import json
import logging

from fastapi import APIRouter, Query, Request, Response
from sqlalchemy import update

from app.agents import AgentOrchestrator
from app.models.database import async_session
from app.models.user import FlowLog
from app.services.gemini import GeminiService
from app.services.memory import MemoryService
from app.services.payment import PaymentService
from app.services.usage import UsageService
from app.services.whatsapp import WhatsAppService
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["webhook"])

# Singletons initialised once
whatsapp = WhatsAppService()
gemini = GeminiService()
orchestrator = AgentOrchestrator(gemini)
memory = MemoryService()
usage_service = UsageService()
payment_service = PaymentService()


@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
) -> Response:
    """WhatsApp webhook verification (GET)."""
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("Webhook verified successfully")
        return Response(content=hub_challenge, media_type="text/plain")

    logger.warning("Webhook verification failed")
    return Response(content="Verification failed", status_code=403)


@router.post("/webhook")
async def handle_webhook(request: Request) -> dict:
    """Process incoming WhatsApp messages."""
    raw_body = await request.body()
    
    # Rate limiting (IP-based or global simple token bucket)
    # Using a simple global or IP-based rate limit via Redis
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"rate_limit:{client_ip}"
    
    try:
        r = await memory._get_redis()
        current_requests = await r.incr(rate_limit_key)
        if current_requests == 1:
            await r.expire(rate_limit_key, 60) # 1 minute window
        
        if current_requests > settings.RATE_LIMIT_PER_MINUTE:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return Response(content="Rate limit exceeded", status_code=429)
    except Exception as e:
        logger.warning(f"Rate limiting failed (Redis might be down): {e}")

    # Log incoming request
    async with async_session() as session:
        log = FlowLog(
            direction="inbound",
            payload=raw_body.decode("utf-8", errors="ignore"),
            status="received"
        )
        session.add(log)
        await session.commit()
        await session.refresh(log)
        log_id = log.id

    try:
        payload = json.loads(raw_body)
    except Exception:
        payload = {}

    # Parse the incoming message
    parsed = WhatsAppService.parse_incoming_message(payload)
    if not parsed:
        async with async_session() as session:
            await session.execute(update(FlowLog).where(FlowLog.id == log_id).values(status="ignored"))
            await session.commit()
        return {"status": "ignored"}

    sender = parsed["sender"]
    text = parsed["text"]
    message_id = parsed["message_id"]
    sender_name = parsed.get("sender_name", "")

    # Update log with sender
    async with async_session() as session:
        await session.execute(update(FlowLog).where(FlowLog.id == log_id).values(sender=sender, status="processing"))
        await session.commit()

    logger.info("Message from %s: %s", sender, text[:100])

    # Mark as read immediately
    try:
        await whatsapp.mark_as_read(message_id)
    except Exception:
        pass

    # Check for special commands
    if text.lower().strip() in ("/start", "hi", "hello", "hey"):
        welcome = (
            f"Hey{' ' + sender_name.split()[0] if sender_name else ''} 👋\n\n"
            "I'm *Yell AI* — your space to vent, rant, and get real help.\n\n"
            "Go ahead, tell me what's on your mind. I'm listening. 💛"
        )
        await whatsapp.send_message(sender, welcome)
        await memory.add_message(sender, "assistant", welcome)
        return {"status": "ok"}

    if text.lower().strip() == "/clear":
        await memory.clear_history(sender)
        await whatsapp.send_message(sender, "Fresh start! 🧹 What's on your mind?")
        return {"status": "ok"}

    # Check usage limits
    usage_status = await usage_service.check_usage(sender)

    if not usage_status["allowed"]:
        # Create payment link for upsell
        user = await usage_service.get_or_create_user(sender)
        payment_url = await payment_service.create_payment_link(sender, user.id)

        upsell_text = (
            "You've used all your free conversations for today. 💫\n\n"
            "Upgrade to *Yell AI Pro* for ₹900/month and get 1000 conversations/day!\n\n"
        )
        if payment_url:
            upsell_text += f"👉 Upgrade here: {payment_url}"
        else:
            upsell_text += "Reply *UPGRADE* and we'll set you up!"

        await whatsapp.send_message(sender, upsell_text)
        return {"status": "limit_reached"}

    # Get conversation history
    history = await memory.get_conversation_history(sender)

    # Store user message in memory
    await memory.add_message(sender, "user", text)

    # Process through agent orchestrator
    try:
        result = await orchestrator.process(text, history)

        # Store AI response
        await memory.add_message(
            sender,
            "assistant",
            result.full_response,
            emotion=result.emotion,
            intent=result.intent,
        )

        # Send response via WhatsApp
        # Split long messages (WhatsApp has ~4096 char limit)
        response_text = result.full_response
        if len(response_text) > 4000:
            chunks = [response_text[i:i+4000] for i in range(0, len(response_text), 4000)]
            for chunk in chunks:
                await whatsapp.send_message(sender, chunk)
        else:
            await whatsapp.send_message(sender, response_text)

        # Increment usage
        await usage_service.increment_usage(sender)

        # Mark log as success
        async with async_session() as session:
            await session.execute(update(FlowLog).where(FlowLog.id == log_id).values(status="success"))
            await session.commit()

    except Exception as exc:
        logger.error("Error processing message: %s", exc, exc_info=True)
        # Mark log as error
        async with async_session() as session:
            await session.execute(update(FlowLog).where(FlowLog.id == log_id).values(status="error", error_message=str(exc)))
            await session.commit()
        fallback = "I'm here for you, but I'm having a moment. Try again in a bit? 💛"
        await whatsapp.send_message(sender, fallback)

    return {"status": "ok"}
