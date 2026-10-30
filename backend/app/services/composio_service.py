"""Owner-scoped Composio connections and versioned tools, independent of agent type."""

import logging
import re
from typing import Any, Optional
from urllib.parse import urlsplit

import httpx
from sqlalchemy import select

from app.config import Settings, get_settings
from app.models.database import async_session, ensure_tables
from app.models.user import UserConnection

logger = logging.getLogger(__name__)
settings = get_settings()

# Pre-provisioned Composio v3 Managed OAuth Config IDs for Astra AI
SUPPORTED_TOOLKITS: dict[str, dict[str, str]] = {
    "hubspot": {
        "name": "HubSpot", "icon": "🔶", "category": "CRM",
        "description": "Manage contacts, companies, and deals", "auth_config_id": "",
    },
    "salesforce": {
        "name": "Salesforce", "icon": "☁️", "category": "CRM",
        "description": "Work with leads, accounts, and opportunities", "auth_config_id": "",
    },
    "pipedrive": {
        "name": "Pipedrive", "icon": "🟢", "category": "CRM",
        "description": "Manage people, deals, and sales activities", "auth_config_id": "",
    },
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


class ConnectorError(Exception):
    """Public, credential-free error with an HTTP status and outcome certainty."""

    def __init__(self, message: str, status_code: int = 502, *, uncertain: bool = False):
        super().__init__(message)
        self.status_code = status_code
        self.uncertain = uncertain


class ComposioService:
    """Shared integration layer; callers supply a verified owner, never OAuth tokens."""

    def __init__(self, *, config: Settings | None = None, session_factory=None,
                 initialize=None, transport: httpx.AsyncBaseTransport | None = None):
        self.config = config or settings
        self.api_key = self.config.COMPOSIO_API_KEY
        self.base_url = self.config.COMPOSIO_BASE_URL.rstrip("/")
        # Older deployments set v1 although the service historically ignored it.
        if self.base_url == "https://backend.composio.dev/api/v1":
            self.base_url = "https://backend.composio.dev/api/v3"
        self.sessions = session_factory or async_session
        self.initialize = initialize or ensure_tables
        self.transport = transport

    def _toolkit(self, toolkit: str) -> str:
        slug = toolkit.lower().strip()
        if slug not in SUPPORTED_TOOLKITS:
            raise ConnectorError("Unsupported toolkit", 400)
        return slug

    def _auth_config(self, toolkit: str) -> str:
        return self.config.COMPOSIO_AUTH_CONFIGS.get(
            toolkit, SUPPORTED_TOOLKITS[toolkit]["auth_config_id"]
        )

    def list_toolkits(self) -> list[dict[str, Any]]:
        return [{"slug": slug, **{k: v for k, v in meta.items() if k != "auth_config_id"},
                 "configured": bool(self.api_key and self._auth_config(slug))}
                for slug, meta in SUPPORTED_TOOLKITS.items()]

    async def _request(self, method: str, path: str, *, executing=False, **kwargs) -> dict:
        if not self.api_key:
            raise ConnectorError("App connections are not configured", 503)
        try:
            async with httpx.AsyncClient(timeout=25, transport=self.transport) as client:
                response = await client.request(method, f"{self.base_url}{path}",
                                                headers={"x-api-key": self.api_key}, **kwargs)
        except httpx.RequestError as exc:
            raise ConnectorError("Connection provider is unavailable", 503,
                                 uncertain=executing) from exc
        if response.status_code == 404:
            raise ConnectorError("Provider resource not found", 404)
        if not response.is_success:
            raise ConnectorError("Connection provider rejected the request", 502,
                                 uncertain=executing and response.status_code >= 500)
        if response.status_code == 204:
            return {}
        try:
            data = response.json()
            if not isinstance(data, dict):
                raise ValueError("Expected object")
            return data
        except ValueError as exc:
            raise ConnectorError("Invalid response from connection provider", 502,
                                 uncertain=executing) from exc

    async def _stored(self, phone: str) -> dict[str, UserConnection]:
        await self.initialize()
        async with self.sessions() as session:
            rows = (await session.execute(select(UserConnection).where(
                UserConnection.phone_number == normalize_phone(phone)))).scalars().all()
            return {row.toolkit: row for row in rows}

    @staticmethod
    def _status(account: dict) -> str:
        if account.get("is_disabled"):
            return "disabled"
        return {"ACTIVE": "active", "INITIATED": "pending", "INITIALIZING": "pending",
                "INACTIVE": "inactive", "FAILED": "failed", "EXPIRED": "expired",
                "REVOKED": "revoked"}.get(str(account.get("status", "")).upper(), "unknown")

    @staticmethod
    def _owned(account: dict, phone: str, toolkit: str, connection_id: str | None = None) -> bool:
        return (account.get("user_id") == entity_id_for_phone(phone)
                and account.get("toolkit", {}).get("slug") == toolkit
                and (connection_id is None or account.get("id") == connection_id))

    async def get_user_connections(self, phone_number: str) -> list[dict[str, Any]]:
        phone = normalize_phone(phone_number)
        stored = await self._stored(phone)
        verified = False
        if self.api_key:
            try:
                accounts = []
                cursor = None
                seen = set()
                while True:
                    params = {"user_ids": entity_id_for_phone(phone), "limit": 100}
                    if cursor:
                        params["cursor"] = cursor
                    data = await self._request("GET", "/connected_accounts", params=params)
                    accounts.extend(data.get("items", []))
                    cursor = data.get("next_cursor")
                    if not cursor:
                        break
                    if cursor in seen:
                        raise ConnectorError("Invalid connection pagination")
                    seen.add(cursor)
                for slug in SUPPORTED_TOOLKITS:
                    existing = stored.get(slug)
                    candidates = [a for a in accounts if self._owned(a, phone, slug) and a.get("id")]
                    # Keep the selected account. Never silently switch identities on a run.
                    account = next((a for a in candidates if existing and a["id"] == existing.connection_id), None)
                    if not existing and candidates:
                        account = next((a for a in candidates if self._status(a) == "active"), candidates[0])
                    if account:
                        await self._upsert_connection(phone, slug, self._status(account),
                                                      connection_id=account["id"])
                    elif existing:
                        await self._upsert_connection(phone, slug, "disconnected")
                stored = await self._stored(phone)
                verified = True
            except ConnectorError:
                # Cached information remains in the DB but must not masquerade as live ACTIVE.
                logger.warning("Could not refresh connection statuses")
        return [{**meta, "status": (stored[meta["slug"]].status if verified else "unknown")
                 if meta["slug"] in stored else "disconnected",
                 "verified": verified,
                 "updated_at": stored[meta["slug"]].updated_at.isoformat()
                 if meta["slug"] in stored and stored[meta["slug"]].updated_at else None}
                for meta in self.list_toolkits()]

    async def create_auth_link(self, phone_number: str, toolkit: str,
                               redirect_url: Optional[str] = None) -> dict[str, Any]:
        phone, slug = normalize_phone(phone_number), self._toolkit(toolkit)
        config_id = self._auth_config(slug)
        if not self.api_key or not config_id:
            raise ConnectorError("This app connection has not been configured", 503)
        callback = redirect_url or f"{self.config.APP_FRONTEND_URL}/?connected={slug}"
        target = urlsplit(callback)
        allowed_origins = {(urlsplit(url).scheme, urlsplit(url).netloc) for url in
                           (self.config.FRONTEND_URL, self.config.APP_FRONTEND_URL)}
        if ((target.scheme, target.netloc) not in allowed_origins or target.username or target.password):
            raise ConnectorError("OAuth callback must use an application origin", 400)
        data = await self._request("POST", "/connected_accounts/link", json={
            "auth_config_id": config_id, "user_id": entity_id_for_phone(phone), "callback_url": callback,
        })
        auth_url, account_id = data.get("redirect_url"), data.get("connected_account_id")
        if not auth_url or urlsplit(auth_url).scheme != "https" or not account_id:
            raise ConnectorError("Connection provider did not return a valid authorization link")
        await self._upsert_connection(phone, slug, "pending", auth_url=auth_url, connection_id=account_id)
        return {"phone_number": phone, "toolkit": slug, "toolkit_name": SUPPORTED_TOOLKITS[slug]["name"],
                "auth_url": auth_url, "connection_id": account_id, "status": "pending"}

    async def is_active_on_composio(self, phone_number: str, toolkit: str) -> bool:
        slug = self._toolkit(toolkit)
        connections = await self.get_user_connections(phone_number)
        return any(c["slug"] == slug and c["status"] == "active" and c["verified"] for c in connections)

    async def mark_connected(self, phone_number: str, toolkit: str) -> dict[str, Any]:
        """A browser redirect is only a hint; Composio must confirm the account."""
        phone, slug = normalize_phone(phone_number), self._toolkit(toolkit)
        previous = (await self._stored(phone)).get(slug)
        was_active = previous is not None and previous.status == "active"
        active = await self.is_active_on_composio(phone, slug)
        if active:
            await self._upsert_connection(phone, slug, "active")
        stored = (await self._stored(phone)).get(slug)
        status = "active" if active else stored.status if stored else "pending"
        if not active and status == "active":
            status = "unknown"
        return {"phone_number": phone, "toolkit": slug, "status": status,
                "newly_active": active and not was_active}

    async def get_active_connection(self, phone_number: str, toolkit: str) -> dict:
        phone, slug = normalize_phone(phone_number), self._toolkit(toolkit)
        connection = (await self._stored(phone)).get(slug)
        if not connection or not connection.connection_id or connection.status in {"disconnected", "revoked"}:
            raise ConnectorError("Connect this app before running its tools", 409)
        account = await self._request("GET", f"/connected_accounts/{connection.connection_id}")
        if not self._owned(account, phone, slug, connection.connection_id):
            raise ConnectorError("Connection does not belong to this user and app", 403)
        status = self._status(account)
        await self._upsert_connection(phone, slug, status)
        if status != "active":
            raise ConnectorError("App connection is not active", 409)
        return account

    async def disconnect(self, phone_number: str, toolkit: str) -> dict:
        phone, slug = normalize_phone(phone_number), self._toolkit(toolkit)
        connection = (await self._stored(phone)).get(slug)
        if connection and connection.connection_id:
            try:
                account = await self._request("GET", f"/connected_accounts/{connection.connection_id}")
                if not self._owned(account, phone, slug, connection.connection_id):
                    raise ConnectorError("Connection does not belong to this user and app", 403)
                await self._request("DELETE", f"/connected_accounts/{connection.connection_id}")
            except ConnectorError as exc:
                if exc.status_code != 404:
                    raise
            await self._upsert_connection(phone, slug, "disconnected")
        return {"toolkit": slug, "status": "disconnected"}

    async def list_tools(self, toolkit: str, *, query: str = "", cursor: str | None = None) -> dict:
        slug = self._toolkit(toolkit)
        params = {"toolkit_slug": slug, "toolkit_versions": self.config.COMPOSIO_TOOL_VERSIONS.get(slug, "latest"),
                  "limit": 25, "query": query}
        if cursor:
            params["cursor"] = cursor
        data = await self._request("GET", "/tools", params=params)
        return {"items": [item for item in data.get("items", []) if item.get("toolkit", {}).get("slug") == slug],
                "next_cursor": data.get("next_cursor")}

    async def resolve_tool(self, toolkit: str, tool_slug: str) -> dict:
        slug = self._toolkit(toolkit)
        if not re.fullmatch(r"[A-Z][A-Z0-9_]{1,127}", tool_slug):
            raise ConnectorError("Invalid tool slug", 400)
        data = await self._request("GET", f"/tools/{tool_slug}", params={
            "version": self.config.COMPOSIO_TOOL_VERSIONS.get(slug, "latest")})
        if data.get("slug") != tool_slug or data.get("toolkit", {}).get("slug") != slug:
            raise ConnectorError("Tool does not belong to the selected app", 400)
        if not data.get("version") or data["version"] == "latest":
            raise ConnectorError("Provider did not resolve a concrete tool version")
        return data

    async def execute_action(self, phone_number: str, action_slug: str, params: dict[str, Any], *,
                             toolkit: str, version: str, connection_id: str) -> dict[str, Any]:
        """Internal executor: public execution goes through owner-approved ToolRunService."""
        account = await self.get_active_connection(phone_number, toolkit)
        if account["id"] != connection_id:
            raise ConnectorError("App account changed; create a new tool preview", 409)
        data = await self._request("POST", f"/tools/execute/{action_slug}", executing=True, json={
            "user_id": entity_id_for_phone(phone_number), "connected_account_id": connection_id,
            "version": version, "arguments": params,
        })
        if not isinstance(data.get("successful"), bool):
            raise ConnectorError("Provider did not confirm an execution outcome", uncertain=True)
        return data

    async def _upsert_connection(self, phone_number: str, toolkit: str, status: str,
                                 auth_url: Optional[str] = None, connection_id: Optional[str] = None) -> None:
        await self.initialize()
        async with self.sessions() as session:
            row = (await session.execute(select(UserConnection).where(
                UserConnection.phone_number == phone_number, UserConnection.toolkit == toolkit))).scalar_one_or_none()
            if row is None:
                row = UserConnection(phone_number=phone_number, toolkit=toolkit, status=status)
                session.add(row)
            row.status = status
            # Clear OAuth links after completion, revocation, or failure.
            row.auth_url = auth_url if status == "pending" else None
            if connection_id is not None:
                row.connection_id = connection_id
            await session.commit()


