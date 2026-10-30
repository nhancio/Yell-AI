"""WhatsApp integration — Meta WhatsApp Cloud API (Graph API)."""

import hashlib
import hmac
import logging
from typing import Any, Mapping, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# API base URLs
GRAPH_API_URL = "https://graph.facebook.com/v19.0"


class WhatsAppService:
    """Send and receive messages through the Meta WhatsApp Cloud API."""

    def __init__(self) -> None:
        self.phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
        self.base_url = f"{GRAPH_API_URL}/{self.phone_number_id}/messages"
        self.headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # Sending
    # ------------------------------------------------------------------

    async def send_message(self, phone_number: str, text: str) -> dict[str, Any]:
        """Send a plain text message to a WhatsApp user."""
        payload = {
            "messaging_product": "whatsapp",
            "to": phone_number,
            "type": "text",
            "text": {"preview_url": False, "body": text},
        }
        return await self._post(payload)

    async def send_interactive_message(
        self,
        phone_number: str,
        body: str,
        buttons: list[dict[str, str]],
    ) -> dict[str, Any]:
        """Send an interactive button message (used for payment upsell etc.)."""
        button_rows = [
            {"type": "reply", "reply": {"id": btn["id"], "title": btn["title"]}}
            for btn in buttons[:3]  # WhatsApp allows max 3 buttons
        ]
        payload = {
            "messaging_product": "whatsapp",
            "to": phone_number,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body},
                "action": {"buttons": button_rows},
            },
        }
        return await self._post(payload)

    async def send_cta_url_message(
        self,
        phone_number: str,
        body: str,
        button_text: str,
        url: str,
    ) -> dict[str, Any]:
        """Send a CTA URL button message (e.g., payment link)."""
        payload = {
            "messaging_product": "whatsapp",
            "to": phone_number,
            "type": "interactive",
            "interactive": {
                "type": "cta_url",
                "body": {"text": body},
                "action": {
                    "name": "cta_url",
                    "parameters": {"display_text": button_text, "url": url},
                },
            },
        }
        return await self._post(payload)

    async def mark_as_read(self, message_id: str) -> None:
        """Mark an incoming message as read (blue ticks)."""
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id,
        }
        try:
            await self._post(payload)
        except Exception:
            logger.warning("Failed to mark message %s as read", message_id)

    # ------------------------------------------------------------------
    # Parsing (Meta webhook format)
    # ------------------------------------------------------------------

    @staticmethod
    def verify_signature(body: bytes, headers: Mapping[str, str]) -> bool:
        """True only if the raw body carries Meta's valid X-Hub-Signature-256 (HMAC-SHA256, app secret).

        Without this, anyone could POST a fake message "from" any phone number and act as that user.
        """
        secret = settings.WHATSAPP_APP_SECRET
        signature = headers.get("x-hub-signature-256", "").removeprefix("sha256=")
        if not secret or not signature:
            return False
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    @staticmethod
    def parse_incoming_message(
        payload: dict[str, Any],
    ) -> Optional[dict[str, str]]:
        """Extract sender phone number, message text, and message id.

        Returns None when the payload is not a user message (e.g. status
        updates or media-only messages without caption).
        """
        try:
            entry = payload.get("entry", [])
            if not entry:
                return None

            changes = entry[0].get("changes", [])
            if not changes:
                return None

            value = changes[0].get("value", {})
            messages = value.get("messages", [])
            if not messages:
                return None

            message = messages[0]
            msg_type = message.get("type", "")
            message_id = message.get("id", "")
            sender = message.get("from", "")

            # Extract sender name if available
            contacts = value.get("contacts", [])
            sender_name = ""
            if contacts:
                profile = contacts[0].get("profile", {})
                sender_name = profile.get("name", "")

            # Handle text messages
            if msg_type == "text":
                text = message.get("text", {}).get("body", "").strip()
                if not text:
                    return None
                return {
                    "sender": sender,
                    "sender_name": sender_name,
                    "text": text,
                    "message_id": message_id,
                    "type": "text",
                }

            # Handle interactive button replies
            if msg_type == "interactive":
                interactive = message.get("interactive", {})
                btn_reply = interactive.get("button_reply", {})
                return {
                    "sender": sender,
                    "sender_name": sender_name,
                    "text": btn_reply.get("title", ""),
                    "message_id": message_id,
                    "type": "interactive",
                    "button_id": btn_reply.get("id", ""),
                }

            # Handle contact cards (.vcf / contacts)
            if msg_type == "contacts":
                contacts_data = message.get("contacts", [])
                details = []
                for c in contacts_data:
                    c_name = c.get("name", {}).get("formatted_name", "Unknown Contact")
                    c_phones = [p.get("phone", "") for p in c.get("phones", []) if p.get("phone")]
                    c_emails = [e.get("email", "") for e in c.get("emails", []) if e.get("email")]
                    detail_str = f"Name: {c_name}"
                    if c_phones:
                        detail_str += f", Phone: {', '.join(c_phones)}"
                    if c_emails:
                        detail_str += f", Email: {', '.join(c_emails)}"
                    details.append(detail_str)
                text = f"[Contact Card shared: {' | '.join(details)}]"
                return {
                    "sender": sender,
                    "sender_name": sender_name,
                    "text": text,
                    "message_id": message_id,
                    "type": "contacts",
                }

            # Handle location
            if msg_type == "location":
                loc = message.get("location", {})
                lat = loc.get("latitude", "")
                lon = loc.get("longitude", "")
                name = loc.get("name", "")
                address = loc.get("address", "")
                loc_text = f"[Shared Location: {name or 'Pinned Location'} ({lat}, {lon}) {address}]"
                return {
                    "sender": sender,
                    "sender_name": sender_name,
                    "text": loc_text,
                    "message_id": message_id,
                    "type": "location",
                }

            # Handle sticker
            if msg_type == "sticker":
                return {
                    "sender": sender,
                    "sender_name": sender_name,
                    "text": "[Sent a sticker 👍]",
                    "message_id": message_id,
                    "type": "sticker",
                }

            # Handle image / audio / video / document with caption
            if msg_type in ("image", "audio", "video", "document"):
                caption = message.get(msg_type, {}).get("caption", "")
                default_text = f"[Sent a voice note]" if msg_type == "audio" else f"[Sent an image]" if msg_type == "image" else f"[Sent a {msg_type}]"
                return {
                    "sender": sender,
                    "sender_name": sender_name,
                    "text": caption if caption else default_text,
                    "message_id": message_id,
                    "type": msg_type,
                }

            # Fallback for other message types
            return {
                "sender": sender,
                "sender_name": sender_name,
                "text": f"[Shared {msg_type}]",
                "message_id": message_id,
                "type": msg_type,
            }

        except (KeyError, IndexError) as exc:
            logger.error("Error parsing WhatsApp payload: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                self.base_url,
                json=payload,
                headers=self.headers,
            )
            if resp.status_code not in (200, 201):
                logger.error(
                    "WhatsApp API error %s: %s", resp.status_code, resp.text
                )
            if resp.status_code not in (200, 201):
                return {"error": resp.text, "status_code": resp.status_code}
            return resp.json()
