"""Firebase Phone Auth verification for the Astra App (astra.nhancio.com)."""

import logging
from typing import Optional

from fastapi import Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import get_settings
from app.models.database import async_session, ensure_tables
from app.models.user import VerifiedWhatsAppAccount
from app.services.composio_service import normalize_phone

logger = logging.getLogger(__name__)
settings = get_settings()
_request = google_requests.Request()


async def has_verified_whatsapp_login(phone: str) -> bool:
    """An existing usage profile or knowledge of the agent number never grants access."""
    await ensure_tables()
    async with async_session() as session:
        return await session.get(VerifiedWhatsAppAccount, normalize_phone(phone)) is not None


async def verify_firebase_token(token: str) -> dict:
    """Verify a Firebase ID token and return its claims."""
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
