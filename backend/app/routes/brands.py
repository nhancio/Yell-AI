"""Brand Ads Management Portal API — Campaign Builder, Wallet Pre-Pay, Analytics & Click Tracking."""

import logging
from typing import Any, Optional
from pydantic import BaseModel, HttpUrl

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.config import get_settings
from app.models.database import async_session
from app.models.user import SponsoredCampaign
from app.services.ads_service import AdsService
from app.services.payment import PaymentService

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["brands"])
ads_service = AdsService()
payment_service = PaymentService()


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
        return RedirectResponse(url="https://yell.nhancio.com", status_code=status.HTTP_302_FOUND)
    return RedirectResponse(url=dest_url, status_code=status.HTTP_302_FOUND)


# ------------------------------------------------------------------
# Brand Campaign API
# ------------------------------------------------------------------

@router.get("/api/brands/campaigns")
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


@router.post("/api/brands/campaigns")
async def create_brand_campaign(req: CampaignCreateRequest) -> dict[str, Any]:
    """Create a new campaign. If budget > 0, creates campaign and returns details."""
    try:
        created = await ads_service.create_campaign(req.dict())
        return {"status": "created", "campaign": created}
    except Exception as exc:
        logger.error("Error creating campaign: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/brands/campaigns/{campaign_id}/prepay")
async def prepay_campaign_budget(campaign_id: int, req: PrepayRequest) -> dict[str, Any]:
    """Generate a Razorpay Order for prepaid ad wallet deposit."""
    if not payment_service.client:
        raise HTTPException(status_code=503, detail="Payment gateway not configured")

    amount_paise = req.amount_inr * 100
    try:
        order = payment_service.client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"ad_camp_{campaign_id}",
            "notes": {
                "campaign_id": str(campaign_id),
                "type": "brand_wallet_prepay",
            }
        })
        return {
            "order_id": order["id"],
            "amount_paise": amount_paise,
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID,
        }
    except Exception as exc:
        logger.error("Razorpay order creation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Payment initiation failed: {exc}")


@router.post("/api/brands/campaigns/{campaign_id}/verify-payment")
async def verify_campaign_payment(campaign_id: int, req: PaymentVerifyRequest) -> dict[str, Any]:
    """Verify Razorpay payment signature and credit the campaign wallet."""
    if not payment_service.client:
        raise HTTPException(status_code=503, detail="Payment gateway not configured")

    # Verify signature
    try:
        import hmac, hashlib
        generated_signature = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
            f"{req.razorpay_order_id}|{req.razorpay_payment_id}".encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if generated_signature != req.razorpay_signature:
            raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Signature verification failed: {exc}")

    # Credit wallet & activate campaign
    amount_paise = req.amount_inr * 100
    async with async_session() as session:
        result = await session.execute(
            select(SponsoredCampaign).where(SponsoredCampaign.id == campaign_id)
        )
        camp = result.scalar_one_or_none()
        if not camp:
            raise HTTPException(status_code=404, detail="Campaign not found")

        camp.budget_paise = getattr(camp, "budget_paise", 0) + amount_paise
        camp.is_active = True
        await session.commit()
        await session.refresh(camp)

        return {
            "status": "wallet_funded",
            "campaign_id": camp.id,
            "new_budget_inr": camp.budget_paise / 100,
            "is_active": camp.is_active
        }


@router.patch("/api/brands/campaigns/{campaign_id}/toggle")
async def toggle_campaign_status(campaign_id: int) -> dict[str, Any]:
    """Toggle campaign active or paused."""
    new_status = await ads_service.toggle_campaign(campaign_id)
    return {"id": campaign_id, "is_active": new_status}
