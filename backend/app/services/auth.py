"""WhatsApp (primary) and Firebase Phone Auth (backup) verification for the Astra App."""

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from typing import Optional
from urllib.parse import quote

from fastapi import Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.models.database import async_session, ensure_tables
from app.models.user import VerifiedWhatsAppAccount
from app.services.composio_service import normalize_phone
from app.services.memory import memory_service

logger = logging.getLogger(__name__)
settings = get_settings()
_request = google_requests.Request()
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CHALLENGE_TTL_SECONDS = 600
_SESSION_TTL_SECONDS = 30 * 86400


def _signing_secret() -> bytes:
    raw = f"{settings.ADMIN_API_KEY}:{settings.WHATSAPP_APP_SECRET}".strip(":")
    if not raw:
        if settings.ENVIRONMENT == "production":
            raise RuntimeError("Signing secret is required in production")
        raw = "astra-dev-whatsapp-session-secret"
    return raw.encode("utf-8")


async def _record_verified_whatsapp(phone: str) -> str:
    norm = normalize_phone(phone)
    await ensure_tables()
    async with async_session() as session:
        if await session.get(VerifiedWhatsAppAccount, norm) is None:
            session.add(VerifiedWhatsAppAccount(phone_number=norm))
            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()
    return norm


def create_whatsapp_session_token(phone: str, ttl_seconds: int = _SESSION_TTL_SECONDS) -> str:
    """Mint an HMAC-SHA256 signed Astra session token for a WhatsApp-verified phone number."""
    norm = normalize_phone(phone)
    now = int(time.time())
    payload = json.dumps(
        {"phone_number": f"+{norm}", "iat": now, "exp": now + ttl_seconds, "auth": "whatsapp"},
        separators=(",", ":"),
    ).encode("utf-8")
    b64 = base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")
    sig = hmac.new(_signing_secret(), b64.encode("ascii"), hashlib.sha256).hexdigest()
    return f"wa.{b64}.{sig}"


def verify_whatsapp_session_token(token: str) -> dict:
    """Verify an Astra `wa.<payload>.<sig>` token and return its claims."""
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != "wa":
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    _, b64, sig = parts
    expected = hmac.new(_signing_secret(), b64.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    try:
        padded = b64 + "=" * (-len(b64) % 4)
        claims = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    if not isinstance(claims, dict) or int(claims.get("exp", 0)) <= int(time.time()):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    if not claims.get("phone_number"):
        raise HTTPException(status_code=403, detail="Phone number not verified on this account")
    return claims


async def start_whatsapp_login_challenge() -> dict:
    """Create a short-lived challenge code for 1-tap WhatsApp sign-in on /app."""
    code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
    poll_token = secrets.token_urlsafe(24)
    await memory_service.set_value(
        f"astra:wa_login:{code}",
        json.dumps({"poll_token": poll_token, "phone": None}),
        ttl=_CHALLENGE_TTL_SECONDS,
    )
    text = f"Sign in to Astra (code: {code})"
    wa_url = f"https://wa.me/{settings.WHATSAPP_DISPLAY_NUMBER}?text={quote(text)}"
    return {
        "code": code,
        "poll_token": poll_token,
        "whatsapp_url": wa_url,
        "expires_in": _CHALLENGE_TTL_SECONDS,
    }


async def complete_whatsapp_login_from_webhook(phone: str, code: Optional[str] = None) -> tuple[bool, str]:
    """Bind a Meta-verified WhatsApp sender to a pending web login code and/or 1-tap magic link."""
    norm = normalize_phone(phone)
    if code:
        clean_code = code.strip().upper()
        raw = await memory_service.get_value(f"astra:wa_login:{clean_code}")
        if not raw:
            return False, ""
        try:
            data = json.loads(raw)
        except Exception:
            return False, ""
        if data.get("phone") is not None:
            return False, ""
        data["phone"] = norm
        await memory_service.set_value(
            f"astra:wa_login:{clean_code}",
            json.dumps(data),
            ttl=_CHALLENGE_TTL_SECONDS,
        )
    await _record_verified_whatsapp(norm)
    ticket = secrets.token_urlsafe(24)
    await memory_service.set_value(f"astra:wa_ticket:{ticket}", norm, ttl=_CHALLENGE_TTL_SECONDS)
    magic_url = f"{settings.APP_FRONTEND_URL.rstrip('/')}/app?wa_token={ticket}"
    return True, magic_url


async def poll_whatsapp_login_challenge(code: str, poll_token: str) -> dict:
    """Check whether the user has sent their WhatsApp login message yet; mint a session token once verified."""
    clean_code = code.strip().upper()
    raw = await memory_service.get_value(f"astra:wa_login:{clean_code}")
    if not raw:
        raise HTTPException(status_code=404, detail="Login code expired. Please start again.")
    try:
        data = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=404, detail="Login code expired. Please start again.")
    if not hmac.compare_digest(str(data.get("poll_token", "")), poll_token.strip()):
        raise HTTPException(status_code=403, detail="Invalid login session")
    phone = data.get("phone")
    if not phone:
        return {"status": "pending"}
    await memory_service.pop_value(f"astra:wa_login:{clean_code}")
    norm = await _record_verified_whatsapp(phone)
    return {
        "status": "verified",
        "token": create_whatsapp_session_token(norm),
        "phone_number": f"+{norm}",
    }


async def exchange_whatsapp_ticket(ticket: str) -> dict:
    """Exchange a 1-tap WhatsApp magic-link ticket (`?wa_token=...`) for a session token."""
    phone = await memory_service.pop_value(f"astra:wa_ticket:{ticket.strip()}")
    if not phone:
        raise HTTPException(status_code=401, detail="This WhatsApp sign-in link has expired or was already used.")
    norm = await _record_verified_whatsapp(phone)
    return {
        "status": "verified",
        "token": create_whatsapp_session_token(norm),
        "phone_number": f"+{norm}",
    }


async def has_verified_whatsapp_login(phone: str) -> bool:
    """An existing usage profile or knowledge of the agent number never grants access."""
    await ensure_tables()
    async with async_session() as session:
        return await session.get(VerifiedWhatsAppAccount, normalize_phone(phone)) is not None


async def verify_firebase_token(token: str) -> dict:
    """Verify a WhatsApp session token or Firebase ID token and return its claims."""
    if token.startswith("wa."):
        return verify_whatsapp_session_token(token)
    try:
        claims = await run_in_threadpool(
            id_token.verify_firebase_token,
            token,
            _request,
            settings.FIREBASE_PROJECT_ID,
        )
    except Exception as exc:
        logger.info("Firebase token rejected: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid session")
    return claims


async def current_phone(authorization: Optional[str] = Header(default=None)) -> str:
    """FastAPI dependency: returns the verified, normalized phone (e.g. 919876543210)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Login required")
    claims = await verify_firebase_token(authorization.split(" ", 1)[1].strip())
    phone = claims.get("phone_number")
    if not phone:
        raise HTTPException(status_code=403, detail="Phone number not verified on this account")
    return normalize_phone(phone)
