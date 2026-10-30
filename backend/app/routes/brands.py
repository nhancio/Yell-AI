"""Brand Ads Management Portal API — Campaign Builder, Wallet Pre-Pay, Analytics & Click Tracking."""

import logging
from typing import Any, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse

from app.services.ads_service import AdsService
from app.routes.admin import verify_admin_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["brands"])
ads_service = AdsService()


class CampaignCreateRequest(BaseModel):
    brand_name: str
    category: str  # travel, food, finance, career, shopping, general
    target_intent: str = "all"  # railway/flight, food_order, founder_pitch, tax/upi, all
    headline: str
    cta_text: str
    cta_url: str
    cpm_inr: int = 300
    budget_inr: int = 5000  # Prepaid wallet deposit in INR
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


class PrepayRequest(BaseModel):
    amount_inr: int = 5000


class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    amount_inr: int


# ------------------------------------------------------------------
# Public Click-Tracking Redirect
# ------------------------------------------------------------------

@router.get("/r/{campaign_id}")
async def track_and_redirect(campaign_id: int):
    """Public click tracking redirect. Increments campaign clicks and 302 redirects to CTA URL."""
    dest_url = await ads_service.record_click(campaign_id)
    if not dest_url:
        return RedirectResponse(url="https://astra.nhancio.com", status_code=status.HTTP_302_FOUND)
    return RedirectResponse(url=dest_url, status_code=status.HTTP_302_FOUND)


# ------------------------------------------------------------------
# Brand Campaign API
# ------------------------------------------------------------------

@router.get("/api/brands/campaigns", dependencies=[Depends(verify_admin_key)])
async def list_brand_campaigns() -> dict[str, Any]:
    """List all campaigns with live impressions, clicks, CTR, and remaining budget."""
    campaigns = await ads_service.list_campaigns()
    
    total_impressions = sum(c["impressions"] for c in campaigns)
    total_clicks = sum(c["clicks"] for c in campaigns)
    total_spent_inr = sum(c["spent_inr"] for c in campaigns)
    total_budget_inr = sum(c["budget_inr"] for c in campaigns)
    active_count = sum(1 for c in campaigns if c["is_active"])
    avg_ctr = round((total_clicks / total_impressions * 100), 2) if total_impressions > 0 else 0.0

    return {
        "campaigns": campaigns,
        "metrics": {
            "total_campaigns": len(campaigns),
            "active_campaigns": active_count,
            "total_impressions": total_impressions,
            "total_clicks": total_clicks,
            "avg_ctr_percent": avg_ctr,
            "total_budget_inr": total_budget_inr,
            "total_spent_inr": total_spent_inr,
        }
    }


@router.post("/api/brands/campaigns", dependencies=[Depends(verify_admin_key)])
async def create_brand_campaign(req: CampaignCreateRequest) -> dict[str, Any]:
    """Create a new campaign. If budget > 0, creates campaign and returns details."""
    try:
        created = await ads_service.create_campaign(req.model_dump())
        return {"status": "created", "campaign": created}
    except Exception as exc:
        logger.error("Error creating campaign: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/brands/campaigns/{campaign_id}/prepay", dependencies=[Depends(verify_admin_key)])
async def prepay_campaign_budget(campaign_id: int, req: PrepayRequest) -> dict[str, Any]:
    """Do not accept wallet payments until settlement can be verified safely."""
    raise HTTPException(status_code=503, detail="Wallet funding is disabled pending server-side settlement verification")


@router.post("/api/brands/campaigns/{campaign_id}/verify-payment", dependencies=[Depends(verify_admin_key)])
async def verify_campaign_payment(campaign_id: int, req: PaymentVerifyRequest) -> dict[str, Any]:
    """Legacy client-supplied amounts and replayable receipts must never credit a wallet."""
    raise HTTPException(status_code=503, detail="Wallet funding is disabled pending server-side settlement verification")


@router.patch("/api/brands/campaigns/{campaign_id}/toggle", dependencies=[Depends(verify_admin_key)])
async def toggle_campaign_status(campaign_id: int) -> dict[str, Any]:
    """Toggle campaign active or paused."""
    new_status = await ads_service.toggle_campaign(campaign_id)
    return {"id": campaign_id, "is_active": new_status}
