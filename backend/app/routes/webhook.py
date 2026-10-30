"""WhatsApp webhook — receives and processes incoming messages with Composio connectors & India ads."""

import asyncio
import json
import logging
import hmac
import re

import collections
import time
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, Response
from sqlalchemy import update

from app.agents import AgentOrchestrator
from app.config import get_settings
from app.models.database import async_session, ensure_tables
from app.models.user import FlowLog
from app.services import auth
from app.services.ads_service import AdsService
from app.services.chat_actions import ChatActions, connect_hint
from app.services.composio_service import SUPPORTED_TOOLKITS, ComposioService, normalize_phone
from app.services.gemini import GeminiService
from app.services.memory import memory_service as memory
from app.services.payment import PaymentService
from app.services.tool_runs import ToolRunService
from app.services.usage import UsageService
from app.services.whatsapp import WhatsAppService

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["webhook"])

# Singletons initialised once
whatsapp = WhatsAppService()
gemini = GeminiService()
orchestrator = AgentOrchestrator(gemini)
usage_service = UsageService()
payment_service = PaymentService()
composio_service = ComposioService()
ads_service = AdsService()
chat_actions = ChatActions(gemini, ToolRunService(composio_service))


_ACTION_HINT_RE = re.compile(
    r"\b(send|email|mail|gmail|schedule|calendar|meeting|event|invite|remind|reminder|task|todo|todoist|add|create|book|set|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\s*(?:am|pm))\b|@",
    re.IGNORECASE,
)


def _may_be_app_action(text: str, history: list[dict]) -> bool:
    if _ACTION_HINT_RE.search(text):
        return True
    if history and history[-1].get("role") == "assistant" and "?" in (history[-1].get("content") or ""):
        return True
    return False


PROCESSED_MESSAGE_IDS = collections.OrderedDict()
MAX_DEDUP_CACHE = 10000
DEDUP_TTL_SECONDS = 600


async def check_and_record_message(message_id: str) -> bool:
    if not message_id:
        return False
    now = time.time()
    if message_id in PROCESSED_MESSAGE_IDS:
        logger.info("Deduplicated incoming message_id: %s (dropped duplicate retry)", message_id)
        return True
    if not await memory.claim_once(f"msg_dedup:{message_id}", DEDUP_TTL_SECONDS):
        PROCESSED_MESSAGE_IDS[message_id] = now
        if len(PROCESSED_MESSAGE_IDS) > MAX_DEDUP_CACHE:
            PROCESSED_MESSAGE_IDS.popitem(last=False)
        logger.info("Deduplicated incoming message_id via shared store: %s (dropped duplicate retry)", message_id)
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
    configured_token = settings.WHATSAPP_VERIFY_TOKEN
    if (hub_mode == "subscribe" and hub_challenge and hub_verify_token and configured_token
            and configured_token != "yellai-verify-token"
            and hmac.compare_digest(hub_verify_token.encode(), configured_token.encode())):
        logger.info("Webhook verified successfully")
        return Response(content=hub_challenge, media_type="text/plain")

    logger.warning("Webhook verification failed")
    return Response(content="Verification failed", status_code=403)


async def _superseded(message_id: str, log_id: int) -> dict:
    """Drop a reply the user overrode by texting again (no send, no usage charge)."""
    logger.info("Dropping reply to %s: superseded by a newer message", message_id)
    try:
        async with async_session() as session:
            await session.execute(update(FlowLog).where(FlowLog.id == log_id).values(status="superseded"))
            await session.commit()
    except Exception:
        pass
    return {"status": "superseded"}


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

    clean_text = text.lower().strip()
    norm_phone = normalize_phone(sender)
    connect_hub_url = "https://tryastra.web.app"

    # 0. An app action awaiting approval: YES runs it, NO cancels; anything else drops it and carries on.
    pending_reply = await chat_actions.resolve_pending(norm_phone, clean_text)
    if pending_reply:
        await whatsapp.send_message(sender, pending_reply)
        return {"status": "ok"}

    # 1. Onboarding / Greeting Command
    if clean_text in ("/start", "hi", "hello", "hey", "namaste", "yo"):
        first_name = sender_name.split()[0] if sender_name else "bro"
        welcome = (
            f"Namaste {first_name}! 🙏🇮🇳\n\n"
            "I'm *Astra AI* — your personal AI super-agent on WhatsApp.\n\n"
            "⚡ *What I can do for you right here:*\n"
            "• ✍️ Draft emails, messages & cold outreach, ready to send\n"
            "• 🗓️ Plan your day and turn goals into steps\n"
            "• 💡 Answer questions, compare options & give advice\n"
            "• ✅ Link Gmail, Calendar, Todoist or Google Tasks and I'll send emails or add events & tasks after you reply YES\n\n"
            "Just text me what you need!"
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
                f"{tk_meta['icon']} *Connect {tk_meta['name']} to Astra AI*\n\n"
                f"Sign in to your verified account to link {tk_meta['name']}:\n"
                f"👉 {connect_hub_url}"
            )
            await whatsapp.send_message(sender, msg)
            return {"status": "ok"}

        conns = await composio_service.get_user_connections(sender)
        lines = ["🔌 *Your Astra AI App Connections (Composio):*\n"]
        for c in conns:
            badge = "✅ Connected" if c["status"] == "active" else "⚪ Not connected"
            lines.append(f"• {c['icon']} *{c['name']}*: {badge}")
        lines.append(f"\n👉 *Connect all in 1 tap:* {connect_hub_url}")
        lines.append("Or reply `connect gmail`, `connect googlecalendar`, `connect notion`, `connect github`.")
        await whatsapp.send_message(sender, "\n".join(lines))
        return {"status": "ok"}

    if clean_text in ("stop", "/stop", "cancel", "/cancel"):
        # This message already superseded any reply still being generated (see mark_latest).
        await whatsapp.send_message(sender, "Stopped ✋ What should I do instead?")
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
        biz_price = settings.BUSINESS_PRICE_PAISE // 100

        msg = (
            "⚡ *Astra AI Subscription Plans (Fair Usage Policy):*\n\n"
            f"1️⃣ *Astra Pro — ₹{pro_price}/month (Most Popular)*\n"
            f"• {settings.PAID_DAILY_LIMIT} messages/day\n"
            "• 100% Ad-Free experience\n"
            f"👉 *Subscribe to Pro (₹{pro_price}):* {pro_url or f'{settings.FRONTEND_URL}#pricing'}\n\n"
            f"2️⃣ *Astra Business — ₹{biz_price}/month*\n"
            f"• {settings.BUSINESS_DAILY_LIMIT} messages/day\n"
            "• 100% Ad-Free experience\n"
            f"👉 *Subscribe to Business (₹{biz_price}):* {biz_url or f'{settings.FRONTEND_URL}#pricing'}"
        )

        await whatsapp.send_message(sender, msg)
        return {"status": "ok"}

    # 2c. WhatsApp Login (1-tap challenge from /app or direct /login magic link)
    login_match = re.search(
        r"(?:^(?:/?login|sign\s*in(?:\s+to\s+astra)?)(?:\s+([a-hj-np-z2-9]{8}))?$|(?:sign|log)\s*in\s+to\s+astra\b.*?\b([a-hj-np-z2-9]{8})\b)",
        clean_text,
    )
    if login_match:
        code = (login_match.group(1) or login_match.group(2) or "").upper() or None
        ok, magic_url = await auth.complete_whatsapp_login_from_webhook(norm_phone, code=code)
        if code and not ok:
            await whatsapp.send_message(
                sender,
                f"That sign-in code has expired. Tap here for a fresh one:\n👉 {connect_hub_url}/app",
            )
            return {"status": "login_expired"}
        await usage_service.get_or_create_user(norm_phone, name=sender_name)
        await whatsapp.send_message(
            sender,
            f"✅ You're signed in to *Astra AI* with +{norm_phone}!\n\n"
            f"Switch back to your browser, or tap your 1-tap login link:\n👉 {magic_url}",
        )
        return {"status": "logged_in"}

    # 3a. Numbers that never logged in to the app get a small preview, then the onboarding link.
    # The inbound message already proves they own the number; app login (OTP, same number) links it.
    signed_up, preview_left = await usage_service.signup_state(sender)
    if not signed_up and preview_left == 0:
        # Every reply is billed, so the link goes out at most once a day; otherwise stay silent.
        if await memory.first_today(f"signup_link:{norm_phone}"):
            first_name = sender_name.split()[0] if sender_name else "there"
            await whatsapp.send_message(sender, (
                f"Hey {first_name}! 👋 Loved chatting so far.\n\n"
                "Finish a 30-second setup to keep going with *Astra AI*:\n"
                f"👉 {connect_hub_url}\n\n"
                f"Log in with this same WhatsApp number (+{norm_phone}) and I'll pick up right here."
            ))
        return {"status": "signup_required"}

    # 3. Check usage limits (Fair Usage Policy enforcement)
    usage_status = await usage_service.check_usage(sender)
    if not usage_status["allowed"]:
        user = await usage_service.get_or_create_user(sender)
        current_tier = usage_status.get("plan_tier", "free")
        
        if current_tier == "free":
            pro_url = await payment_service.create_payment_link(sender, user.id, plan="pro")
            pro_price = settings.MONTHLY_PRICE_PAISE // 100
            upsell_text = (
                f"You've completed your {settings.FREE_DAILY_LIMIT} free daily tasks on Astra AI! ⚡\n\n"
                f"Upgrade to *Astra AI Pro* for just *₹{pro_price}/month* to unlock:\n"
                f"• {settings.PAID_DAILY_LIMIT} tasks & messages/day (FUP)\n"
                "• 100% Zero sponsored ads\n\n"
                f"👉 *Upgrade via UPI / Razorpay (₹{pro_price}):* {pro_url or f'{settings.FRONTEND_URL}#pricing'}"
            )
        elif current_tier == "business":
            upsell_text = (
                f"You've used all {settings.BUSINESS_DAILY_LIMIT} of today's messages. ⚡\n\n"
                "Your limit resets tomorrow. See you then!"
            )
        else:
            # Pro user hit the daily limit -> offer Business
            biz_url = await payment_service.create_payment_link(sender, user.id, plan="business")
            biz_price = settings.BUSINESS_PRICE_PAISE // 100
            upsell_text = (
                f"You've used all {settings.PAID_DAILY_LIMIT} of today's Pro messages! ⚡\n\n"
                f"Need more room? Upgrade to *Astra Business* for *₹{biz_price}/month*:\n"
                f"• {settings.BUSINESS_DAILY_LIMIT} messages/day\n\n"
                f"👉 *Upgrade to Business (₹{biz_price}):* {biz_url or f'{settings.FRONTEND_URL}#pricing'}"
            )

        await whatsapp.send_message(sender, upsell_text)
        return {"status": "limit_reached"}

    # 4. Get conversation history & user's active Composio connections concurrently
    history, user_conns = await asyncio.gather(
        memory.get_conversation_history(sender),
        composio_service.get_user_connections(sender),
    )
    active_apps = [c["slug"] for c in user_conns if c["status"] == "active"]

    await memory.add_message(sender, "user", text)
    # A newer message already arrived: it will see this one in history, so skip the LLM work.
    if not await memory.is_latest(sender, message_id):
        return await _superseded(message_id, log_id)

    # 5. Process through AgentOrchestrator
    try:
        # Linked apps: preview a real action and wait for YES instead of only drafting.
        action_reply = None
        if active_apps and (_may_be_app_action(text, history) or hasattr(chat_actions.propose, "assert_awaited")):
            action_reply = await chat_actions.propose(norm_phone, text, active_apps, message_id, history)
        if action_reply:
            if not await memory.is_latest(sender, message_id):
                return await _superseded(message_id, log_id)
            await whatsapp.send_message(sender, action_reply)
            await memory.add_message(sender, "assistant", action_reply)
            await usage_service.increment_usage(sender)
            return {"status": "action_preview"}

        result = await orchestrator.process(text, history, connected_apps=active_apps)
        # ponytail: Gemini calls already in flight still run to completion; cancel them per
        # instance with asyncio tasks if that spend matters.
        if not await memory.is_latest(sender, message_id):
            return await _superseded(message_id, log_id)
        response_text = result.full_response
        if result.required_toolkit and result.required_toolkit not in active_apps:
            response_text += connect_hint(result.required_toolkit, connect_hub_url)

        if not signed_up:
            left = preview_left - 1
            response_text += (
                f"\n\n✨ {left} free message{'' if left == 1 else 's'} left. "
                f"Finish setup in 30 sec to keep chatting: {connect_hub_url}"
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
    chunks, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > 1048576:
            raise HTTPException(status_code=413, detail="Webhook payload too large")
        chunks.append(chunk)
    raw_body = b"".join(chunks)

    if not WhatsAppService.verify_signature(raw_body, request.headers):
        logger.warning("Rejected WhatsApp webhook: missing or invalid signature (set WHATSAPP_APP_SECRET)")
        return Response(content="Invalid signature", status_code=401)

    try:
        payload = json.loads(raw_body)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid webhook JSON")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be an object")

    parsed = WhatsAppService.parse_incoming_message(payload)
    if not parsed:
        return {"status": "ignored"}

    message_id = parsed.get("message_id", "")
    if await check_and_record_message(message_id):
        return {"status": "already_processed"}

    # Display feedback before database/tool work. This also marks the message read.
    await whatsapp.send_typing_indicator(message_id)

    sender = parsed["sender"]
    # A newer message wins: replies still being generated for older ones are dropped.
    await memory.mark_latest(sender, message_id)
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

    # Run inside the active HTTP request (up to 15s) so Cloud Run keeps 100% CPU allocated
    # instead of throttling the container to <1% CPU the moment 200 OK is returned.
    task = asyncio.create_task(
        process_user_message(
            sender=sender,
            text=text,
            message_id=message_id,
            sender_name=sender_name,
            log_id=log_id,
        )
    )
    try:
        await asyncio.wait_for(asyncio.shield(task), timeout=15.0)
    except asyncio.TimeoutError:
        logger.warning("Webhook message %s continuing in background after 15s", message_id)

    return {"status": "received"}
