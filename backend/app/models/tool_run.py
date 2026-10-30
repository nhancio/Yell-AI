"""Owner-scoped, durable previews and results for external actions."""

from sqlalchemy import Column, DateTime, JSON, String, Text, UniqueConstraint, func

from app.models.database import Base


class ToolRun(Base):
    __tablename__ = "tool_runs"
    __table_args__ = (UniqueConstraint("phone_number", "idempotency_key", name="uq_tool_run_request"),)

    id = Column(String(36), primary_key=True)
    phone_number = Column(String(20), nullable=False, index=True)
    idempotency_key = Column(String(128), nullable=False)
    toolkit = Column(String(64), nullable=False)
    tool_slug = Column(String(128), nullable=False)
    version = Column(String(64), nullable=False)
    connection_id = Column(String(128), nullable=False)
    arguments = Column(JSON, nullable=False)
    status = Column(String(32), nullable=False)
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
