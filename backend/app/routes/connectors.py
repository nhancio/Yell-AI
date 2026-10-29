"""Routes for 1-tap Composio OAuth Connectors & India Contextual Ad Campaigns."""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.ads_service import AdsService
from app.services.composio_service import ComposioService, normalize_phone
from app.services.whatsapp import WhatsAppService

router = APIRouter(prefix="/api", tags=["connectors", "ads"])
composio_service = ComposioService()
ads_service = AdsService()
whatsapp_service = WhatsAppService()


class ConnectLinkRequest(BaseModel):
    phone_number: str
    toolkit: str
    redirect_url: Optional[str] = None
    send_whatsapp_link: bool = False


class ExecuteToolRequest(BaseModel):
    phone_number: str
    action_slug: str
    params: dict[str, Any] = {}


@router.get("/connectors/toolkits")
async def list_toolkits() -> dict[str, Any]:
    """List all supported 1-tap OAuth connectors for Yell AI."""
    return {"toolkits": composio_service.list_toolkits()}


@router.get("/connectors/status")
async def get_user_connector_status(
    phone: str = Query(..., description="User WhatsApp phone number")
) -> dict[str, Any]:
    """Get status of all connectors for a given WhatsApp phone number."""
    norm = normalize_phone(phone)
    if not norm:
        raise HTTPException(status_code=400, detail="Valid phone number required")
    connections = await composio_service.get_user_connections(norm)
    return {"phone_number": norm, "connections": connections}


@router.post("/connectors/link")
async def create_connector_link(body: ConnectLinkRequest) -> dict[str, Any]:
    """Generate a 1-tap Composio OAuth URL and optionally send it to the user on WhatsApp."""
    try:
        res = await composio_service.create_auth_link(
            phone_number=body.phone_number,
            toolkit=body.toolkit,
            redirect_url=body.redirect_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if body.send_whatsapp_link and res.get("auth_url"):
        try:
            msg = (
                f"🔌 *Connect {res['toolkit_name']} to Yell AI*\n\n"
                f"Tap once below to authorize {res['toolkit_name']}. "
                f"After connecting, you can manage everything directly inside this WhatsApp chat! 🇮🇳"
            )
            await whatsapp_service.send_cta_url_message(
                phone_number=res["phone_number"],
                body=msg,
                button_text=f"Connect {res['toolkit_name']}",
                url=res["auth_url"],
            )
            res["whatsapp_sent"] = True
        except Exception:
            res["whatsapp_sent"] = False

    return res


@router.post("/connectors/confirm")
async def confirm_connector_callback(body: ConnectLinkRequest) -> dict[str, Any]:
    """Mark a toolkit as active when the user returns from OAuth redirect."""
    res = await composio_service.mark_connected(body.phone_number, body.toolkit)
    try:
        await whatsapp_service.send_message(
            res["phone_number"],
            f"✅ *{body.toolkit.upper()} is now connected to Yell AI!*\n\n"
            "Try asking me to check your inbox, schedule a meeting, or run a task right here in WhatsApp. 🚀",
        )
    except Exception:
        pass
    return res


@router.post("/connectors/execute")
async def execute_connector_tool(body: ExecuteToolRequest) -> dict[str, Any]:
    """Execute a Composio action for a connected WhatsApp user."""
    return await composio_service.execute_action(
        phone_number=body.phone_number,
        action_slug=body.action_slug,
        params=body.params,
    )


@router.get("/ads/campaigns")
async def list_ad_campaigns() -> dict[str, Any]:
    """List active India contextual ad campaigns and impression metrics."""
    campaigns = await ads_service.list_campaigns()
    return {"campaigns": campaigns}
