"""Database models for users, usage tracking, Composio connections, ads, and conversation history."""

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.models.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    phone_number = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=True)
    city = Column(String(64), nullable=True)
    preferred_language = Column(String(32), default="hinglish", nullable=False)
    is_premium = Column(Boolean, default=False, nullable=False)
    premium_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    usages = relationship("UserUsage", back_populates="user", lazy="selectin")
    conversations = relationship("Conversation", back_populates="user", lazy="selectin")
    connections = relationship("UserConnection", back_populates="user", lazy="selectin")

    def __repr__(self) -> str:
        return f"<User {self.phone_number} premium={self.is_premium}>"


class UserConnection(Base):
    """Tracks one-tap OAuth app connections (via Composio) per WhatsApp user."""

    __tablename__ = "user_connections"
    __table_args__ = (
        UniqueConstraint("phone_number", "toolkit", name="uq_phone_toolkit"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    phone_number = Column(String(20), nullable=False, index=True)
    toolkit = Column(String(64), nullable=False)  # e.g., "gmail", "googlecalendar", "notion", "github", "linkedin"
    connection_id = Column(String(128), nullable=True)  # Composio connectedAccountId
    status = Column(String(32), default="pending", nullable=False)  # "pending", "active", "revoked"
    auth_url = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user = relationship("User", back_populates="connections")

    def __repr__(self) -> str:
        return f"<UserConnection {self.phone_number} toolkit={self.toolkit} status={self.status}>"


class SponsoredCampaign(Base):
    """Contextual India brand ad campaigns served inside free-tier WhatsApp responses."""

    __tablename__ = "sponsored_campaigns"

    id = Column(Integer, primary_key=True, autoincrement=True)
    brand_name = Column(String(128), nullable=False)
    category = Column(String(64), nullable=False, index=True)  # travel, food, finance, career, shopping, general
    headline = Column(String(256), nullable=False)
    cta_text = Column(String(128), nullable=False)
    cta_url = Column(Text, nullable=False)
    cpm_inr = Column(Integer, default=250, nullable=False)
    impressions = Column(Integer, default=0, nullable=False)
    clicks = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class UserUsage(Base):
    __tablename__ = "user_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, default=date.today, nullable=False)
    query_count = Column(Integer, default=0, nullable=False)

    user = relationship("User", back_populates="usages")

    def __repr__(self) -> str:
        return f"<UserUsage user_id={self.user_id} date={self.date} count={self.query_count}>"


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(16), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    emotion = Column(String(32), nullable=True)
    intent = Column(String(64), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="conversations")

    def __repr__(self) -> str:
        return f"<Conversation user_id={self.user_id} role={self.role}>"


class FlowLog(Base):
    __tablename__ = "flow_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    direction = Column(String(16), nullable=False)  # "inbound" or "outbound"
    sender = Column(String(32), nullable=True)
    status = Column(String(16), nullable=False)  # "success", "error", "ignored"
    payload = Column(Text, nullable=True)  # Raw JSON
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<FlowLog {self.direction} {self.status}>"
