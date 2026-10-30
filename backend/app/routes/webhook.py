"""WhatsApp webhook — receives and processes incoming messages with Composio connectors & India ads."""

import json
import logging

from fastapi import APIRouter, Query, Request, Response
from sqlalchemy import update

from app.agents import AgentOrchestrator
from app.config import get_settings
from app.models.database import async_session, ensure_tables
from app.models.user import FlowLog
from app.services.ads_service import AdsService
from app.services.composio_service import SUPPORTED_TOOLKITS, ComposioService, normalize_phone
from app.services.gemini import GeminiService
from app.services.memory import MemoryService
from app.services.payment import PaymentService
from app.services.usage import UsageService
from app.services.whatsapp import WhatsAppService

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
composio_service = ComposioService()
ads_service = AdsService()


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

    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"rate_limit:{client_ip}"

    try:
        r = await memory._get_redis()
        current_requests = await r.incr(rate_limit_key)
        if current_requests == 1:
            await r.expire(rate_limit_key, 60)

        if current_requests > settings.RATE_LIMIT_PER_MINUTE:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return Response(content="Rate limit exceeded", status_code=429)
    except Exception as e:
        logger.warning(f"Rate limiting failed (Redis might be down): {e}")

    await ensure_tables()
    async with async_session() as session:
        log = FlowLog(
            direction="inbound",
            payload=raw_body.decode("utf-8", errors="ignore"),
            status="received",
        )
        session.add(log)
        await session.commit()
        await session.refresh(log)
        log_id = log.id

    try:
        payload = json.loads(raw_body)
    except Exception:
        payload = {}

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

    async with async_session() as session:
        await session.execute(update(FlowLog).where(FlowLog.id == log_id).values(sender=sender, status="processing"))
        await session.commit()

    logger.info("Message from %s: %s", sender, text[:100])

    try:
        await whatsapp.mark_as_read(message_id)
    except Exception:
        pass

    clean_text = text.lower().strip()
    norm_phone = normalize_phone(sender)
    connect_hub_url = f"{settings.FRONTEND_URL}/connect?phone={norm_phone}"

    # 1. Onboarding / Greeting Command
    if clean_text in ("/start", "hi", "hello", "hey", "namaste", "yo"):
        first_name = sender_name.split()[0] if sender_name else "bro"
        welcome = (
            f"Namaste {first_name}! 🙏🇮🇳\n\n"
            "I'm *Yell AI* — your personal AI super-agent on WhatsApp.\n\n"
            "⚡ *What I can do for you right here:*\n"
            "• 📧 *Gmail & Calendar:* Read/send emails, book meetings & reminders\n"
            "• 🚀 *Backdoor Hiring:* Draft cold emails to Indian & YC startup founders\n"
            "• 🚆 *India Life-OS:* IRCTC train/flight plans, Swiggy/Blinkit comparisons, UPI budgets\n"
            "• 🧠 *Second Brain:* Sync notes to Notion, Google Sheets & Drive\n\n"
            f"🔌 *Connect your apps once (1-tap):*\n👉 {connect_hub_url}\n\n"
            "Or type `/connect gmail` or just tell me what you want done!"
        )
        await whatsapp.send_message(sender, welcome)
        await memory.add_message(sender, "assistant", welcome)
        return {"status": "ok"}

    # 2. One-Tap App Connection Command (`/connect` or `connect gmail`)
    if clean_text.startswith("/connect") or clean_text.startswith("connect "):
        parts = clean_text.replace("/", "").split()
        if len(parts) >= 2 and parts[1] in SUPPORTED_TOOLKITS:
            tk = parts[1]
            link_res = await composio_service.create_auth_link(sender, tk)
            tk_meta = SUPPORTED_TOOLKITS[tk]
            msg = (
                f"{tk_meta['icon']} *Connect {tk_meta['name']} to Yell AI*\n\n"
                f"Tap once below to link your {tk_meta['name']} account:\n"
                f"👉 {link_res['auth_url']}\n\n"
                "Once connected, you never have to leave WhatsApp again!"
            )
            await whatsapp.send_message(sender, msg)
            return {"status": "ok"}

        conns = await composio_service.get_user_connections(sender)
        lines = ["🔌 *Your Yell AI App Connections (Composio):*\n"]
        for c in conns:
            badge = "✅ Connected" if c["status"] == "active" else "⚪ Not connected"
            lines.append(f"• {c['icon']} *{c['name']}*: {badge}")
        lines.append(f"\n👉 *Connect all in 1 tap:* {connect_hub_url}")
        lines.append("Or reply `connect gmail`, `connect googlecalendar`, `connect notion`, `connect github`.")
        await whatsapp.send_message(sender, "\n".join(lines))
        return {"status": "ok"}

    if clean_text == "/clear":
        await memory.clear_history(sender)
        await whatsapp.send_message(sender, "Fresh start! 🧹 Tell me what we're tackling next.")
        return {"status": "ok"}

    # 2b. Direct Pro Upgrade Command (/upgrade, upgrade, pro)
    if clean_text in ("/upgrade", "upgrade", "pro", "/pro"):
        user = await usage_service.get_or_create_user(sender)
        payment_url = await payment_service.create_payment_link(sender, user.id)
        price_inr = settings.MONTHLY_PRICE_PAISE // 100
        msg = (
            f"⚡ *Upgrade to Yell AI Pro for just ₹{price_inr}/month!*\n\n"
            "Unlock unlimited super-agent powers:\n"
            "• 1,000 tasks & queries every day\n"
            "• Priority execution on Gemini 3.8 Flash\n"
            "• All 8+ Composio tools (Gmail, Calendar, Notion, GitHub)\n"
            "• 100% Ad-Free experience\n"
            "• Automated Backdoor Founder Outreach\n\n"
        )
        if payment_url:
            msg += f"👉 *1-Tap Pay via UPI / Cards / Razorpay:*\n{payment_url}"
        else:
            msg += "Payment link generation is currently syncing with Razorpay. Try again in 1 minute!"

        await whatsapp.send_message(sender, msg)
        return {"status": "ok"}

    # 3. Check usage limits
    usage_status = await usage_service.check_usage(sender)
    if not usage_status["allowed"]:
        user = await usage_service.get_or_create_user(sender)
        payment_url = await payment_service.create_payment_link(sender, user.id)
        price_inr = settings.MONTHLY_PRICE_PAISE // 100
        upsell_text = (
            "You've hit your daily free limit on Yell AI! ⚡\n\n"
            f"Upgrade to *Yell AI Pro* for just *₹{price_inr}/month* (UPI supported) to unlock:\n"
            "• 1,000 tasks & messages/day\n"
            "• Unlimited Gmail, Calendar, Notion & Backdoor Founder Outreach\n"
            "• Zero sponsored ads\n\n"
        )
        if payment_url:
            upsell_text += f"👉 *Upgrade via UPI / Razorpay:* {payment_url}"
        else:
            upsell_text += "Reply *UPGRADE* and we'll activate your Pro pass!"

        await whatsapp.send_message(sender, upsell_text)
        return {"status": "limit_reached"}

    # 4. Get conversation history & user's active Composio connections
    history = await memory.get_conversation_history(sender)
    user_conns = await composio_service.get_user_connections(sender)
    active_apps = [c["slug"] for c in user_conns if c["status"] == "active"]

    await memory.add_message(sender, "user", text)

    # 5. Process through AgentOrchestrator
    try:
        result = await orchestrator.process(text, history, connected_apps=active_apps)
        response_text = result.full_response

        # If the intent needs a Composio toolkit that isn't connected yet, append a 1-tap connect prompt
        req_tk = result.required_toolkit
        if req_tk and req_tk in SUPPORTED_TOOLKITS and req_tk not in active_apps:
            link_res = await composio_service.create_auth_link(sender, req_tk)
            tk_meta = SUPPORTED_TOOLKITS[req_tk]
            response_text += (
                f"\n\n{tk_meta['icon']} *Want me to execute this directly in your {tk_meta['name']}?*\n"
                f"Tap once to connect {tk_meta['name']}: {link_res['auth_url']}"
            )

        # Append contextual India native ad for free-tier users on high-intent queries
        ad_footer = await ads_service.get_contextual_ad(
            intent=result.intent,
            is_premium=usage_status.get("is_premium", False),
            is_crisis=result.is_crisis,
        )
        if ad_footer:
            response_text += f"\n\n{ad_footer}"

        await memory.add_message(
            sender,
            "assistant",
            result.full_response,
            emotion=result.emotion,
            intent=result.intent,
        )

        if len(response_text) > 4000:
            chunks = [response_text[i:i+4000] for i in range(0, len(response_text), 4000)]
            for chunk in chunks:
                await whatsapp.send_message(sender, chunk)
        else:
            await whatsapp.send_message(sender, response_text)

        await usage_service.increment_usage(sender)

        async with async_session() as session:
            await session.execute(update(FlowLog).where(FlowLog.id == log_id).values(status="success"))
            await session.commit()

    except Exception as exc:
        logger.error("Error processing message: %s", exc, exc_info=True)
        async with async_session() as session:
            await session.execute(update(FlowLog).where(FlowLog.id == log_id).values(status="error", error_message=str(exc)))
            await session.commit()
        fallback = "Give me a second bro, reconnecting my tools. Try sending that again? ⚡"
        await whatsapp.send_message(sender, fallback)

    return {"status": "ok"}
