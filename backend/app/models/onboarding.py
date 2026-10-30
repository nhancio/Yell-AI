"""Setup preferences are separate from subscription access and connected accounts."""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, func
from app.models.database import Base


class UserOnboarding(Base):
    __tablename__ = "user_onboarding"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    interests = Column(JSON, nullable=False, default=list)
    step = Column(String(24), nullable=False, default="name")
    completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
