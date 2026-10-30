"""WhatsApp webhook — receives and processes incoming messages with Composio connectors & India ads."""

import json
import logging

import collections
import time
from fastapi import APIRouter, BackgroundTasks, Query, Request, Response
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


PROCESSED_MESSAGE_IDS = collections.OrderedDict()
MAX_DEDUP_CACHE = 10000


def check_and_record_message(message_id: str) -> bool:
    if not message_id:
        return False
    now = time.time()
    if message_id in PROCESSED_MESSAGE_IDS:
        logger.info("Deduplicated incoming message_id: %s (dropped duplicate retry)", message_id)
        return True
    PROCESSED_MESSAGE_IDS[message_id] = now
    if len(PROCESSED_MESSAGE_IDS) > MAX_DEDUP_CACHE:
        PROCESSED_MESSAGE_IDS.popitem(last=False)
    return False


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


async def process_user_message(
    sender: str,
    text: str,
    message_id: str,
    sender_name: str,
    log_id: int,
) -> None:
    """Process incoming message asynchronously in background task (Meta gets 200 immediately)."""
    try:
        async with async_session() as session:
            await session.execute(update(FlowLog).where(FlowLog.id == log_id).values(sender=sender, status="processing"))
            await session.commit()
    except Exception:
        pass

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
            tk_meta = SUPPORTED_TOOLKITS[tk]
            msg = (
                f"{tk_meta['icon']} *Connect {tk_meta['name']} to Yell AI*\n\n"
                f"Sign in to your verified account to link {tk_meta['name']}:\n"
                f"👉 {connect_hub_url}"
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

    # 2b. Direct Upgrade Command (/upgrade, upgrade, pro, business)
    if clean_text in ("/upgrade", "upgrade", "pro", "/pro", "business", "/business"):
        user = await usage_service.get_or_create_user(sender)
        is_requesting_biz = "business" in clean_text
        pro_url = await payment_service.create_payment_link(sender, user.id, plan="pro")
        biz_url = await payment_service.create_payment_link(sender, user.id, plan="business")
        
        pro_price = settings.MONTHLY_PRICE_PAISE // 100
        biz_price = getattr(settings, "BUSINESS_PRICE_PAISE", 99900) // 100

        msg = (
            "⚡ *Yell AI Subscription Plans (Fair Usage Policy):*\n\n"
            f"1️⃣ *Yell Pro — ₹{pro_price}/month (Most Popular)*\n"
            f"• {settings.PAID_DAILY_LIMIT} tasks & queries/day (~2,400 tasks/mo)\n"
            "• Priority Gemini 3.8 Flash execution\n"
            "• All Composio tools (Gmail, Calendar, Notion, GitHub)\n"
            "• 100% Ad-Free experience\n"
            f"👉 *Subscribe to Pro (₹{pro_price}):* {pro_url or f'{settings.FRONTEND_URL}#pricing'}\n\n"
            f"2️⃣ *Yell Business / Team — ₹{biz_price}/month*\n"
            f"• {settings.BUSINESS_DAILY_LIMIT} tasks & queries/day (Enterprise headroom)\n"
            "• Dedicated priority execution & custom connectors\n"
            f"👉 *Subscribe to Business (₹{biz_price}):* {biz_url or f'{settings.FRONTEND_URL}#pricing'}"
        )

        await whatsapp.send_message(sender, msg)
        return {"status": "ok"}

    # 3. Check usage limits (Fair Usage Policy enforcement)
    usage_status = await usage_service.check_usage(sender)
    if not usage_status["allowed"]:
        user = await usage_service.get_or_create_user(sender)
        current_tier = usage_status.get("plan_tier", "free")
        
        if current_tier == "free":
            pro_url = await payment_service.create_payment_link(sender, user.id, plan="pro")
            pro_price = settings.MONTHLY_PRICE_PAISE // 100
            upsell_text = (
                f"You've completed your {settings.FREE_DAILY_LIMIT} free daily tasks on Yell AI! ⚡\n\n"
                f"Upgrade to *Yell AI Pro* for just *₹{pro_price}/month* (UPI Autopay) to unlock:\n"
                f"• {settings.PAID_DAILY_LIMIT} tasks & messages/day (FUP)\n"
                "• Unlimited Gmail, Calendar, Notion & Backdoor Founder Outreach\n"
                "• 100% Zero sponsored ads\n\n"
                f"👉 *Upgrade via UPI / Razorpay (₹{pro_price}):* {pro_url or f'{settings.FRONTEND_URL}#pricing'}"
            )
        else:
            # Pro user hit the 80/day limit -> upsell to Business 1,000 tasks/day
            biz_url = await payment_service.create_payment_link(sender, user.id, plan="business")
            biz_price = getattr(settings, "BUSINESS_PRICE_PAISE", 99900) // 100
            upsell_text = (
                f"You've reached your Pro daily Fair Usage limit of {settings.PAID_DAILY_LIMIT} tasks! ⚡\n\n"
                f"Need heavy enterprise throughput? Upgrade to *Yell Business* for *₹{biz_price}/month*:\n"
                f"• {settings.BUSINESS_DAILY_LIMIT} tasks/day headroom\n"
                "• Multi-workflow automation & team prioritization\n\n"
                f"👉 *Upgrade to Business (₹{biz_price}):* {biz_url or f'{settings.FRONTEND_URL}#pricing'}"
            )

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
            tk_meta = SUPPORTED_TOOLKITS[req_tk]
            response_text += (
                f"\n\n{tk_meta['icon']} *Want me to execute this directly in your {tk_meta['name']}?*\n"
                f"Sign in to connect {tk_meta['name']}: {connect_hub_url}"
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


@router.post("/webhook")
async def handle_webhook(request: Request, background_tasks: BackgroundTasks) -> dict:
    # Process incoming WhatsApp messages with instant ack and deduplication
    raw_body = await request.body()

    if not WhatsAppService.verify_signature(raw_body, request.headers):
        logger.warning("Rejected WhatsApp webhook: missing or invalid signature (set KAPSO_WEBHOOK_SECRET or WHATSAPP_APP_SECRET)")
        return Response(content="Invalid signature", status_code=401)

    try:
        payload = json.loads(raw_body)
    except Exception:
        payload = {}

    parsed = WhatsAppService.parse_incoming_message(payload)
    if not parsed:
        return {"status": "ignored"}

    message_id = parsed.get("message_id", "")
    if check_and_record_message(message_id):
        return {"status": "already_processed"}

    sender = parsed["sender"]
    text = parsed["text"]
    sender_name = parsed.get("sender_name", "")

    log_id = 0
    try:
        await ensure_tables()
        async with async_session() as session:
            log = FlowLog(
                direction="inbound",
                sender=sender,
                payload=text[:500],
                status="received",
            )
            session.add(log)
            await session.commit()
            await session.refresh(log)
            log_id = log.id
    except Exception as exc:
        logger.debug("FlowLog skip: %s", exc)

    logger.info("Webhook received from %s (%s): %s", sender, sender_name, text[:80])

    background_tasks.add_task(
        process_user_message,
        sender=sender,
        text=text,
        message_id=message_id,
        sender_name=sender_name,
        log_id=log_id,
    )

    return {"status": "received"}
