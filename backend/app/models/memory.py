"""Short-lived shared state, used when no hosted Redis is configured."""

from sqlalchemy import Column, Float, Integer, String, Text

from app.models.database import Base


class MemoryValue(Base):
    __tablename__ = "memory_values"

    key = Column(String(255), primary_key=True)
    value = Column(Text, nullable=False)
    expires_at = Column(Float, nullable=False, index=True)  # epoch seconds


class MemoryMessage(Base):
    __tablename__ = "memory_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    phone_number = Column(String(32), nullable=False, index=True)
    entry = Column(Text, nullable=False)  # JSON message, same shape as the Redis list items
    created_at = Column(Float, nullable=False)  # epoch seconds
