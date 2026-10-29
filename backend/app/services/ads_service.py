"""Contextual India Native Ad Engine — monetizes free-tier WhatsApp users with high-intent Indian brand offers."""

import logging
import random
from typing import Any, Optional

from sqlalchemy import select

from app.config import get_settings
from app.models.database import async_session, ensure_tables
from app.models.user import SponsoredCampaign

logger = logging.getLogger(__name__)
settings = get_settings()

DEFAULT_INDIA_CAMPAIGNS: list[dict[str, Any]] = [
    {
        "brand_name": "Ixigo Trains & Flights",
        "category": "travel",
        "headline": "Zero Payment Gateway Charges on your first IRCTC Train or Domestic Flight booking via UPI!",
        "cta_text": "Use code YELLZERO on Ixigo",
        "cta_url": "https://www.ixigo.com/?utm_source=yell_ai_whatsapp",
        "cpm_inr": 320,
    },
    {
        "brand_name": "Swiggy Instamart / Bolt",
        "category": "food",
        "headline": "Craving midnight chai or snacks? Get ₹100 OFF + Free 10-min delivery on orders above ₹299.",
        "cta_text": "Claim on Swiggy",
        "cta_url": "https://www.swiggy.com/?utm_source=yell_ai_whatsapp",
        "cpm_inr": 280,
    },
    {
        "brand_name": "CRED / Fi Money",
        "category": "finance",
        "headline": "Pay your credit card bills or track UPI spends & earn guaranteed cashback up to ₹250.",
        "cta_text": "Check Reward on CRED",
        "cta_url": "https://cred.club/?utm_source=yell_ai_whatsapp",
        "cpm_inr": 450,
    },
    {
        "brand_name": "Instahyre & Wellfound India",
        "category": "career",
        "headline": "Top funded Bengaluru, Gurgaon & Hyderabad startups are hiring engineers & PMs directly (₹20–60 LPA).",
        "cta_text": "View Direct Founder Roles",
        "cta_url": "https://www.instahyre.com/?utm_source=yell_ai_whatsapp",
        "cpm_inr": 380,
    },
    {
        "brand_name": "Zepto Pass",
        "category": "shopping",
        "headline": "Groceries, electronics & essentials in 10 mins — get flat 20% extra off with Zepto Pass.",
        "cta_text": "Try Zepto Pass for ₹1",
        "cta_url": "https://www.zeptonow.com/?utm_source=yell_ai_whatsapp",
        "cpm_inr": 260,
    },
]

INTENT_TO_AD_CATEGORY: dict[str, str] = {
    "travel_irctc": "travel",
    "food_commerce": "food",
    "budget_planning": "finance",
    "job_search": "career",
    "resume_help": "career",
    "founder_outreach": "career",
    "task_planning": "shopping",
    "email_draft": "career",
}


class AdsService:
    """Selects and records impressions for native 1-line sponsored cards in WhatsApp."""

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
        """Return a native WhatsApp sponsored footer for free-tier users when appropriate."""
        if not settings.ADS_ENABLED or is_premium or is_crisis or intent == "just_venting":
            return None

        await self.ensure_seeded()
        category = INTENT_TO_AD_CATEGORY.get(intent, "")

        try:
            async with async_session() as session:
                stmt = select(SponsoredCampaign).where(SponsoredCampaign.is_active == True)
                if category:
                    cat_result = await session.execute(
                        stmt.where(SponsoredCampaign.category == category)
                    )
                    campaigns = list(cat_result.scalars().all())
                else:
                    campaigns = []

                if not campaigns:
                    all_result = await session.execute(stmt)
                    campaigns = list(all_result.scalars().all())

                if not campaigns:
                    return None

                chosen = random.choice(campaigns)
                chosen.impressions += 1
                await session.commit()

                return (
                    f"━━━━━━━━━━━━━━━\n"
                    f"⚡ *Sponsored • {chosen.brand_name}*\n"
                    f"{chosen.headline}\n"
                    f"👉 _{chosen.cta_text}:_ {chosen.cta_url}"
                )
        except Exception as exc:
            logger.debug("Ad selection failed: %s", exc)
            return None

    async def list_campaigns(self) -> list[dict[str, Any]]:
        await self.ensure_seeded()
        async with async_session() as session:
            result = await session.execute(select(SponsoredCampaign))
            rows = result.scalars().all()
            return [
                {
                    "id": r.id,
                    "brand_name": r.brand_name,
                    "category": r.category,
                    "headline": r.headline,
                    "cta_text": r.cta_text,
                    "cta_url": r.cta_url,
                    "cpm_inr": r.cpm_inr,
                    "impressions": r.impressions,
                    "clicks": r.clicks,
                    "is_active": r.is_active,
                }
                for r in rows
            ]
