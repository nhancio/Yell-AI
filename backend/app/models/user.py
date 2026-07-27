"""Database models for users, usage tracking, and conversation history."""

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
    is_premium = Column(Boolean, default=False, nullable=False)
    premium_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    usages = relationship("UserUsage", back_populates="user", lazy="selectin")
    conversations = relationship("Conversation", back_populates="user", lazy="selectin")

    def __repr__(self) -> str:
        return f"<User {self.phone_number} premium={self.is_premium}>"


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
