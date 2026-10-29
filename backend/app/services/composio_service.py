"""Composio v3 Connector Service — One-tap OAuth linking & tool execution per WhatsApp phone number."""

import json
import logging
import shutil
import subprocess
from typing import Any, Optional

import httpx
from sqlalchemy import select

from app.config import get_settings
from app.models.database import async_session, ensure_tables
from app.models.user import UserConnection

logger = logging.getLogger(__name__)
settings = get_settings()

# Pre-provisioned Composio v3 Managed OAuth Config IDs for Yell AI
SUPPORTED_TOOLKITS: dict[str, dict[str, str]] = {
    "gmail": {
        "name": "Gmail",
        "icon": "📧",
        "description": "Read emails, send replies, track flight/train PNR & Swiggy/Zomato/Amazon receipts",
        "category": "Google Workspace",
        "auth_config_id": "ac_UdLuaJwehTmn",
    },
    "googlecalendar": {
        "name": "Google Calendar",
        "icon": "📅",
        "description": "Auto-schedule meetings, check free/busy, set reminders & Google Meet links",
        "category": "Google Workspace",
        "auth_config_id": "ac_8UuBmMYEzJQQ",
    },
    "googledrive": {
        "name": "Google Drive & Docs",
        "icon": "📁",
        "description": "Find PDFs, resumes, invoices, and summarize documents in WhatsApp",
        "category": "Google Workspace",
        "auth_config_id": "ac_ros5sCkHiYaV",
    },
    "googlesheets": {
        "name": "Google Sheets",
        "icon": "📊",
        "description": "Track expenses, UPI budgets, founder outreach lists, and CRM rows",
        "category": "Google Workspace",
        "auth_config_id": "ac_1P23_HNwER1k",
    },
    "notion": {
        "name": "Notion",
        "icon": "📝",
        "description": "Save notes, manage daily tasks, second-brain pages & project trackers",
        "category": "Productivity",
        "auth_config_id": "ac_oEXKO615UN7t",
    },
    "github": {
        "name": "GitHub",
        "icon": "🐙",
        "description": "Review PRs, check repo issues, and power founder/job outreach",
        "category": "Developer & Career",
        "auth_config_id": "ac_uTB8_6-LhE0R",
    },
    "linkedin": {
        "name": "LinkedIn",
        "icon": "💼",
        "description": "Draft posts, optimize profile, and power Backdoor founder/hiring outreach",
        "category": "Developer & Career",
        "auth_config_id": "ac_Pg28-fo6-rK4",
    },
    "slack": {
        "name": "Slack",
        "icon": "💬",
        "description": "Catch urgent work pings and reply right from WhatsApp",
        "category": "Work Chat",
        "auth_config_id": "ac_xT6d36Yh4vca",
    },
}


def normalize_phone(phone: str) -> str:
    """Normalize phone number into digits only (e.g., 919876543210)."""
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    if len(digits) == 10:
        return f"91{digits}"
    return digits


def entity_id_for_phone(phone: str) -> str:
    """Deterministic Composio user_id for a WhatsApp user."""
    return f"yell_wa_{normalize_phone(phone)}"


class ComposioService:
    """Manages one-time OAuth links and tool execution via Composio v3 REST API."""

    def __init__(self) -> None:
        self.api_key = getattr(settings, "COMPOSIO_API_KEY", "")
        self.base_url = "https://backend.composio.dev/api/v3"
        self.cli_path = shutil.which("composio")

    def list_toolkits(self) -> list[dict[str, str]]:
        """Return metadata for all supported connectors."""
        return [
            {"slug": slug, **meta}
            for slug, meta in SUPPORTED_TOOLKITS.items()
        ]

    async def get_user_connections(self, phone_number: str) -> list[dict[str, Any]]:
        """Return all supported toolkits with the user's current connection status."""
        norm_phone = normalize_phone(phone_number)
        db_map: dict[str, UserConnection] = {}

        await ensure_tables()
        async with async_session() as session:
            result = await session.execute(
                select(UserConnection).where(UserConnection.phone_number == norm_phone)
            )
            for row in result.scalars().all():
                db_map[row.toolkit] = row

        # Also query Composio v3 REST API to refresh active statuses
        if self.api_key:
            try:
                user_id = entity_id_for_phone(norm_phone)
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.get(
                        f"{self.base_url}/connected_accounts",
                        params={"user_ids": user_id},
                        headers={"x-api-key": self.api_key},
                    )
                    if resp.status_code == 200:
                        items = resp.json().get("items", [])
                        for item in items:
                            tk_slug = (item.get("toolkit", {}).get("slug") or "").lower()
                            status = (item.get("status") or "").lower()
                            if tk_slug in SUPPORTED_TOOLKITS and status == "active":
                                await self._upsert_connection(
                                    norm_phone,
                                    tk_slug,
                                    status="active",
                                    connection_id=item.get("id"),
                                )
                                if tk_slug in db_map:
                                    db_map[tk_slug].status = "active"
            except Exception as exc:
                logger.debug("Composio v3 live status check skipped: %s", exc)

        output = []
        for slug, meta in SUPPORTED_TOOLKITS.items():
            conn = db_map.get(slug)
            output.append(
                {
                    "slug": slug,
                    **meta,
                    "status": conn.status if conn else "disconnected",
                    "auth_url": conn.auth_url if conn else None,
                    "updated_at": conn.updated_at.isoformat() if (conn and conn.updated_at) else None,
                }
            )
        return output

    async def create_auth_link(
        self, phone_number: str, toolkit: str, redirect_url: Optional[str] = None
    ) -> dict[str, Any]:
        """Generate a 1-tap Composio v3 OAuth link (`https://connect.composio.dev/link/...`) for a WhatsApp user."""
        norm_phone = normalize_phone(phone_number)
        toolkit_slug = toolkit.lower().strip()
        if toolkit_slug not in SUPPORTED_TOOLKITS:
            raise ValueError(f"Unsupported toolkit: {toolkit_slug}")

        user_id = entity_id_for_phone(norm_phone)
        auth_config_id = SUPPORTED_TOOLKITS[toolkit_slug]["auth_config_id"]
        callback = redirect_url or f"{settings.FRONTEND_URL}/connect?phone={norm_phone}&connected={toolkit_slug}"
        auth_url: Optional[str] = None
        connection_id: Optional[str] = None

        # Strategy 1: Composio v3 `/api/v3/connected_accounts/link`
        if self.api_key:
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"{self.base_url}/connected_accounts/link",
                        headers={"x-api-key": self.api_key, "Content-Type": "application/json"},
                        json={
                            "auth_config_id": auth_config_id,
                            "user_id": user_id,
                            "callback_url": callback,
                        },
                    )
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        auth_url = data.get("redirect_url")
                        connection_id = data.get("connected_account_id")
                    else:
                        logger.warning("Composio v3 link HTTP %s: %s", resp.status_code, resp.text[:250])
            except Exception as exc:
                logger.warning("Composio v3 API link generation failed: %s", exc)

        # Strategy 2: Hosted Connect Hub fallback
        if not auth_url:
            auth_url = (
                f"{settings.FRONTEND_URL}/connect?phone={norm_phone}&setup={toolkit_slug}"
            )

        await self._upsert_connection(
            norm_phone,
            toolkit_slug,
            status="pending",
            auth_url=auth_url,
            connection_id=connection_id,
        )

        return {
            "phone_number": norm_phone,
            "entity_id": user_id,
            "toolkit": toolkit_slug,
            "toolkit_name": SUPPORTED_TOOLKITS[toolkit_slug]["name"],
            "auth_url": auth_url,
            "connection_id": connection_id,
            "status": "pending",
        }

    async def mark_connected(self, phone_number: str, toolkit: str) -> dict[str, Any]:
        """Mark a user's toolkit as active after OAuth callback completes."""
        norm_phone = normalize_phone(phone_number)
        toolkit_slug = toolkit.lower().strip()
        await self._upsert_connection(norm_phone, toolkit_slug, status="active")
        return {"phone_number": norm_phone, "toolkit": toolkit_slug, "status": "active"}

    async def execute_action(
        self, phone_number: str, action_slug: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute a Composio v3 tool action on behalf of the WhatsApp user."""
        norm_phone = normalize_phone(phone_number)
        user_id = entity_id_for_phone(norm_phone)

        if self.api_key:
            try:
                async with httpx.AsyncClient(timeout=25) as client:
                    resp = await client.post(
                        f"{self.base_url}/tools/execute/{action_slug}",
                        headers={"x-api-key": self.api_key, "Content-Type": "application/json"},
                        json={
                            "user_id": user_id,
                            "arguments": params,
                        },
                    )
                    if resp.status_code in (200, 201):
                        return {"successful": True, "data": resp.json()}
                    return {
                        "successful": False,
                        "error": f"Composio v3 HTTP {resp.status_code}: {resp.text[:300]}",
                    }
            except Exception as exc:
                logger.error("Composio v3 execute error: %s", exc)

        return {
            "successful": False,
            "error": "Composio tool execution unavailable.",
        }

    async def _upsert_connection(
        self,
        phone_number: str,
        toolkit: str,
        status: str,
        auth_url: Optional[str] = None,
        connection_id: Optional[str] = None,
    ) -> None:
        await ensure_tables()
        async with async_session() as session:
            result = await session.execute(
                select(UserConnection).where(
                    UserConnection.phone_number == phone_number,
                    UserConnection.toolkit == toolkit,
                )
            )
            conn = result.scalar_one_or_none()
            if conn is None:
                conn = UserConnection(
                    phone_number=phone_number,
                    toolkit=toolkit,
                    status=status,
                    auth_url=auth_url,
                    connection_id=connection_id,
                )
                session.add(conn)
            else:
                conn.status = status
                if auth_url:
                    conn.auth_url = auth_url
                if connection_id:
                    conn.connection_id = connection_id
            await session.commit()
