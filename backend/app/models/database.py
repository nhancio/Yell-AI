"""Async SQLAlchemy engine, session factory, and declarative base."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

_db_url = settings.effective_database_url

_engine_kw: dict = {"echo": False, "pool_pre_ping": True}
if _db_url.startswith("postgresql"):
    _engine_kw["pool_size"] = 10
    _engine_kw["max_overflow"] = 20
    _engine_kw["connect_args"] = {"timeout": 5}

engine = create_async_engine(_db_url, **_engine_kw)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

_tables_initialized = False


class Base(DeclarativeBase):
    pass


async def ensure_tables() -> None:
    global _tables_initialized
    if _tables_initialized:
        return
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    _tables_initialized = True


async def get_db() -> AsyncSession:  # type: ignore[misc]
    await ensure_tables()
    async with async_session() as session:
        yield session
