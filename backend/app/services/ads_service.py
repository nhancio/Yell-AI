"""Contextual India Native Ad Engine — monetizes free-tier WhatsApp users with high-intent Indian brand offers."""

import logging
import random
from typing import Any, Optional

from sqlalchemy import select, update

from app.config import get_settings
from app.models.database import async_session, ensure_tables
from app.models.user import SponsoredCampaign

logger = logging.getLogger(__name__)
settings = get_settings()

DEFAULT_INDIA_CAMPAIGNS: list[dict[str, Any]] = [
    {
        "brand_name": "Ixigo Trains & Flights",
        "category": "travel",
        "target_intent": "railway/flight",
        "headline": "Zero Payment Gateway Charges on your first IRCTC Train or Domestic Flight booking via UPI!",
        "cta_text": "Use code YELLZERO on Ixigo",
        "cta_url": "https://www.ixigo.com/?utm_source=yell_ai_whatsapp",
        "cpm_inr": 320,
        "budget_paise": 500000,  # ₹5,000 seeded wallet
        "spent_paise": 0,
        "is_active": True,
    },
    {
        "brand_name": "Swiggy Instamart / Bolt",
        "category": "food",
        "target_intent": "food_order",
        "headline": "Craving midnight chai or snacks? Get ₹100 OFF + Free 10-min delivery on orders above ₹299.",
        "cta_text": "Claim on Swiggy",
        "cta_url": "https://www.swiggy.com/?utm_source=yell_ai_whatsapp",
        "cpm_inr": 280,
        "budget_paise": 500000,
        "spent_paise": 0,
        "is_active": True,
    },
    {
        "brand_name": "CRED / Fi Money",
        "category": "finance",
        "target_intent": "tax/upi",
        "headline": "Pay your credit card bills or track UPI spends & earn guaranteed cashback up to ₹250.",
        "cta_text": "Check Reward on CRED",
        "cta_url": "https://cred.club/?utm_source=yell_ai_whatsapp",
        "cpm_inr": 450,
        "budget_paise": 500000,
        "spent_paise": 0,
        "is_active": True,
    },
    {
        "brand_name": "Instahyre & Wellfound India",
        "category": "career",
        "target_intent": "founder_pitch",
        "headline": "Top funded Bengaluru, Gurgaon & Hyderabad startups are hiring engineers & PMs directly (₹20–60 LPA).",
        "cta_text": "View Direct Founder Roles",
        "cta_url": "https://www.instahyre.com/?utm_source=yell_ai_whatsapp",
        "cpm_inr": 380,
        "budget_paise": 500000,
        "spent_paise": 0,
        "is_active": True,
    },
    {
        "brand_name": "Zepto Pass",
        "category": "shopping",
        "target_intent": "all",
        "headline": "Groceries, electronics & essentials in 10 mins — get flat 20% extra off with Zepto Pass.",
        "cta_text": "Try Zepto Pass for ₹1",
        "cta_url": "https://www.zeptonow.com/?utm_source=yell_ai_whatsapp",
        "cpm_inr": 260,
        "budget_paise": 500000,
        "spent_paise": 0,
        "is_active": True,
    },
]

INTENT_TO_CATEGORY: dict[str, str] = {
    "travel_irctc": "travel",
    "railway/flight": "travel",
    "food_commerce": "food",
    "food_order": "food",
    "budget_planning": "finance",
    "tax/upi": "finance",
    "job_search": "career",
    "resume_help": "career",
    "founder_outreach": "career",
    "founder_pitch": "career",
    "task_planning": "shopping",
    "email_draft": "career",
}


class AdsService:
    """Manages sponsored campaigns, contextual matching, impression debits, and click tracking."""

    async def ensure_seeded(self) -> None:
        """Seed default India campaigns if table is empty."""
        try:
            await ensure_tables()
            async with async_session() as session:
                result = await session.execute(select(SponsoredCampaign).limit(1))
                if result.scalar_one_or_none() is not None:
                    return
                for item in DEFAULT_INDIA_CAMPAIGNS:
                    session.add(SponsoredCampaign(**item))
                await session.commit()
        except Exception as exc:
            logger.debug("Ad seed skipped: %s", exc)

    async def get_contextual_ad(
        self, intent: str, is_premium: bool = False, is_crisis: bool = False
    ) -> Optional[str]:
        """Select an ad, debit the campaign wallet, and return the formatted WhatsApp card."""
        if not settings.ADS_ENABLED or is_premium or is_crisis or intent == "just_venting":
            return None

        await self.ensure_seeded()
        category = INTENT_TO_CATEGORY.get(intent, "")

        try:
            async with async_session() as session:
                # Query active campaigns
                stmt = select(SponsoredCampaign).where(SponsoredCampaign.is_active.is_(True))
                
                # Match by target_intent or category
                matched: list[SponsoredCampaign] = []
                if intent:
                    intent_res = await session.execute(
                        stmt.where(
                            (SponsoredCampaign.target_intent == intent) |
                            (SponsoredCampaign.target_intent == "all") |
                            (SponsoredCampaign.category == category)
                        )
                    )
                    matched = list(intent_res.scalars().all())

                if not matched:
                    all_res = await session.execute(stmt)
                    matched = list(all_res.scalars().all())

                if not matched:
                    return None

                chosen = random.choice(matched)

                # Calculate impression cost in paise: (cpm_inr * 100) / 1000 = cpm_inr / 10
                cost_paise = max(1, int((chosen.cpm_inr * 100) / 1000))

                chosen.impressions += 1
                chosen.spent_paise += cost_paise

                # Auto-pause when prepaid wallet hits zero
                if chosen.budget_paise > 0 and chosen.spent_paise >= chosen.budget_paise:
                    chosen.is_active = False
                    logger.info("Campaign %s budget depleted (%s spent / %s budget). Auto-paused.", chosen.id, chosen.spent_paise, chosen.budget_paise)

                await session.commit()

                # Generate custom tracking click redirect URL
                track_url = f"{settings.APP_URL}/r/{chosen.id}"

                return (
                    f"━━━━━━━━━━━━━━━\n"
                    f"⚡ *Sponsored • {chosen.brand_name}*\n"
                    f"{chosen.headline}\n"
                    f"👉 _{chosen.cta_text}:_ {track_url}"
                )
        except Exception as exc:
            logger.debug("Ad selection failed: %s", exc)
            return None

    async def record_click(self, campaign_id: int) -> Optional[str]:
        """Record click and return destination URL for redirect."""
        try:
            await ensure_tables()
            async with async_session() as session:
                result = await session.execute(
                    select(SponsoredCampaign).where(SponsoredCampaign.id == campaign_id)
                )
                campaign = result.scalar_one_or_none()
                if not campaign:
                    return None

                campaign.clicks += 1
                await session.commit()
                return campaign.cta_url
        except Exception as exc:
            logger.error("Click record error: %s", exc)
            return None

    async def list_campaigns(self) -> list[dict[str, Any]]:
        """List all campaigns with live stats and wallet metrics."""
        await self.ensure_seeded()
        async with async_session() as session:
            result = await session.execute(
                select(SponsoredCampaign).order_by(SponsoredCampaign.id.desc())
            )
            rows = result.scalars().all()
            return [
                {
                    "id": r.id,
                    "brand_name": r.brand_name,
                    "category": r.category,
                    "target_intent": getattr(r, "target_intent", "all"),
                    "headline": r.headline,
                    "cta_text": r.cta_text,
                    "cta_url": r.cta_url,
                    "cpm_inr": r.cpm_inr,
                    "budget_paise": getattr(r, "budget_paise", 0),
                    "budget_inr": getattr(r, "budget_paise", 0) / 100,
                    "spent_paise": getattr(r, "spent_paise", 0),
                    "spent_inr": getattr(r, "spent_paise", 0) / 100,
                    "remaining_inr": max(0, (getattr(r, "budget_paise", 0) - getattr(r, "spent_paise", 0)) / 100),
                    "impressions": r.impressions,
                    "clicks": r.clicks,
                    "ctr_percent": round((r.clicks / r.impressions * 100), 2) if r.impressions > 0 else 0.0,
                    "is_active": r.is_active,
                    "contact_email": getattr(r, "contact_email", None),
                    "contact_phone": getattr(r, "contact_phone", None),
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ]

    async def create_campaign(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new brand sponsored campaign."""
        await ensure_tables()
        budget_inr = int(data.get("budget_inr", 5000))
        budget_paise = budget_inr * 100
        cpm_inr = int(data.get("cpm_inr", 300))

        async with async_session() as session:
            camp = SponsoredCampaign(
                brand_name=data["brand_name"],
                category=data.get("category", "general"),
                target_intent=data.get("target_intent", "all"),
                headline=data["headline"],
                cta_text=data["cta_text"],
                cta_url=data["cta_url"],
                cpm_inr=cpm_inr,
                budget_paise=budget_paise,
                spent_paise=0,
                is_active=data.get("is_active", True),
                contact_email=data.get("contact_email"),
                contact_phone=data.get("contact_phone"),
            )
            session.add(camp)
            await session.commit()
            await session.refresh(camp)
            return {
                "id": camp.id,
                "brand_name": camp.brand_name,
                "category": camp.category,
                "target_intent": camp.target_intent,
                "budget_inr": budget_inr,
                "cpm_inr": cpm_inr,
                "is_active": camp.is_active,
            }

    async def toggle_campaign(self, campaign_id: int) -> bool:
        """Toggle a campaign active/paused."""
        async with async_session() as session:
            res = await session.execute(
                select(SponsoredCampaign).where(SponsoredCampaign.id == campaign_id)
            )
            camp = res.scalar_one_or_none()
            if not camp:
                return False
            camp.is_active = not camp.is_active
            await session.commit()
            return camp.is_active
