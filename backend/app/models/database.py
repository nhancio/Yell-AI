"""Async SQLAlchemy engine, session factory, and declarative base."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# pool_size / max_overflow apply to PostgreSQL; SQLite (NullPool) rejects them
_engine_kw: dict = {"echo": False}
if settings.DATABASE_URL.startswith("postgresql"):
    _engine_kw["pool_size"] = 10
    _engine_kw["max_overflow"] = 20

engine = create_async_engine(settings.DATABASE_URL, **_engine_kw)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async with async_session() as session:
        yield session
