"""Verified owners can save and resume setup without granting tool or paid access."""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.onboarding import UserOnboarding
from app.models.user import UserConnection
from app.services.auth import current_phone
from app.services.usage import UsageService

router = APIRouter(prefix="/api/me/onboarding", tags=["onboarding"])
usage = UsageService()

Interest = Literal["email", "calendar", "reminders", "notes", "research", "news", "automations",
                   "daily_brief", "sports", "travel", "images", "finances", "shopping", "reservations", "coding"]
Step = Literal["name", "interests", "apps", "ready", "plan", "complete"]


class Preferences(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(None, max_length=128)
    interests: list[Interest] | None = Field(None, max_length=15)
    step: Step | None = None

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value


def state(user, setup: UserOnboarding | None) -> dict:
    return {"name": user.name, "interests": setup.interests if setup else [],
            "step": setup.step if setup else "name",
            "completed": bool(setup and setup.completed_at),
            "completed_at": setup.completed_at.isoformat() if setup and setup.completed_at else None}


async def _has_connected_app_or_plan(db: AsyncSession, user) -> bool:
    if user.is_premium:
        return True
    conn_id = await db.scalar(
        select(UserConnection.id)
        .where(
            UserConnection.phone_number == user.phone_number,
            UserConnection.status == "active",
        )
        .limit(1)
    )
    return conn_id is not None


async def setup_row(db: AsyncSession, user) -> UserOnboarding:
    setup = await db.get(UserOnboarding, user.id)
    if setup is None:
        already_active = await _has_connected_app_or_plan(db, user)
        try:
            async with db.begin_nested():
                setup = UserOnboarding(
                    user_id=user.id,
                    interests=[],
                    step="complete" if already_active else "name",
                    completed_at=datetime.now(UTC) if already_active else None,
                )
                db.add(setup)
                await db.flush()
        except IntegrityError:
            # Another tab may have saved this owner's first setup request concurrently.
            setup = await db.get(UserOnboarding, user.id)
            if setup is None:
                raise
    elif setup.completed_at is None and await _has_connected_app_or_plan(db, user):
        setup.step = "complete"
        setup.completed_at = datetime.now(UTC)
    return setup


@router.get("")
async def get_setup(phone: str = Depends(current_phone), db: AsyncSession = Depends(get_db)) -> dict:
    user = await usage.get_or_create_user(phone, session=db)
    # The row doubles as "this number has logged in" — it unlocks WhatsApp chat past the preview.
    setup = await setup_row(db, user)
    await db.commit()
    return state(user, setup)


@router.patch("")
async def save_setup(body: Preferences, phone: str = Depends(current_phone),
                     db: AsyncSession = Depends(get_db)) -> dict:
    user = await usage.get_or_create_user(phone, session=db)
    setup = await setup_row(db, user)
    if "name" in body.model_fields_set:
        user.name = body.name or None
    if body.interests is not None:
        setup.interests = list(dict.fromkeys(body.interests))
    if body.step is not None:
        setup.step = body.step
        setup.completed_at = datetime.now(UTC) if body.step == "complete" else None
    await db.commit()
    await db.refresh(setup)
    return state(user, setup)
