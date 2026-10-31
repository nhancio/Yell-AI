"""Short-term conversation memory and shared short-lived values."""

import json
import logging
import asyncio
import os
import time
from typing import Any, Optional
from urllib.parse import urlsplit

import redis.asyncio as aioredis
from sqlalchemy import delete, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.config import get_settings
from app.models import database
from app.models.database import ensure_tables
from app.models.memory import MemoryMessage, MemoryValue

logger = logging.getLogger(__name__)
settings = get_settings()

SESSION_TTL_SECONDS = 24 * 60 * 60  # 24 hours
REDIS_RETRY_INTERVAL_SECONDS = 30
HISTORY_MAX_MESSAGES = 50


class MemoryUnavailable(RuntimeError):
    pass


class MemoryService:
    """Store and retrieve recent conversation history.

    Prefers Redis if available, otherwise uses the app database, so every
    container sees the same login codes, history and dedup keys.
    """

    def __init__(self, redis_client: Optional[aioredis.Redis] = None) -> None:
        self._redis = redis_client
        self._connect_lock = asyncio.Lock()
        self._retry_after = 0.0

    async def _get_redis(self) -> Optional[aioredis.Redis]:
        """Return a Redis client, or None to use the database instead."""
        if self._redis is not None:
            return self._redis
        # On Cloud Run (K_SERVICE set), if REDIS_URL points to localhost, there is no local
        # Redis daemon inside the container: use the shared database without a connect attempt.
        if (
            os.environ.get("K_SERVICE")
            and urlsplit(settings.REDIS_URL).hostname in {None, "localhost", "127.0.0.1", "::1"}
        ):
            return None
        async with self._connect_lock:
            if self._redis is not None:
                return self._redis
            if time.monotonic() < self._retry_after:
                if not settings.memory_fallback_allowed:
                    raise MemoryUnavailable("Redis connection is required")
                return None
            client = None
            try:
                client = aioredis.from_url(
                    settings.REDIS_URL, decode_responses=True,
                    socket_connect_timeout=2, socket_timeout=2,
                    health_check_interval=30,
                )
                async with asyncio.timeout(1):
                    await client.ping()
                self._redis = client
            except Exception as exc:
                self._retry_after = time.monotonic() + REDIS_RETRY_INTERVAL_SECONDS
                if client is not None:
                    await client.aclose()
                logger.warning("Redis connection unavailable (%s)", type(exc).__name__)
                if not settings.memory_fallback_allowed:
                    raise MemoryUnavailable("Redis connection is required") from exc
        return self._redis

    async def ping(self) -> bool:
        """Check the shared store; the database backend is checked by the database probe."""
        try:
            client = await self._get_redis()
            return client is None or bool(await client.ping())
        except Exception:
            return False

    def _insert(self):
        insert = pg_insert if database.engine.dialect.name == "postgresql" else sqlite_insert
        return insert(MemoryValue)

    def _key(self, phone_number: str) -> str:
        return f"astra:conv:{phone_number}"

    async def get_conversation_history(
        self, phone_number: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        """Return the last `limit` messages for this user."""
        try:
            r = await self._get_redis()
            if r:
                key = self._key(phone_number)
                raw_messages = await r.lrange(key, -limit, -1)
                return [json.loads(m) for m in raw_messages]

            await ensure_tables()
            async with database.async_session() as session:
                rows = (await session.scalars(
                    select(MemoryMessage.entry)
                    .where(MemoryMessage.phone_number == phone_number,
                           MemoryMessage.created_at > time.time() - SESSION_TTL_SECONDS)
                    .order_by(MemoryMessage.id.desc())
                    .limit(limit)
                )).all()
            return [json.loads(m) for m in reversed(rows)]
        except Exception as exc:
            logger.error("Memory read failed (%s)", type(exc).__name__)
            if not settings.memory_fallback_allowed:
                raise MemoryUnavailable("Conversation memory is unavailable") from exc
            return []

    async def add_message(
        self,
        phone_number: str,
        role: str,
        content: str,
        emotion: Optional[str] = None,
        intent: Optional[str] = None,
    ) -> None:
        """Append a message to the user's conversation history."""
        entry = {
            "role": role,
            "content": content,
        }
        if emotion:
            entry["emotion"] = emotion
        if intent:
            entry["intent"] = intent

        json_entry = json.dumps(entry)

        try:
            r = await self._get_redis()
            if r:
                key = self._key(phone_number)
                if hasattr(r, "pipeline"):
                    pipe = r.pipeline(transaction=False)
                    pipe.rpush(key, json_entry)
                    pipe.ltrim(key, -HISTORY_MAX_MESSAGES, -1)
                    pipe.expire(key, SESSION_TTL_SECONDS)
                    await pipe.execute()
                else:
                    await r.rpush(key, json_entry)
                    await r.ltrim(key, -HISTORY_MAX_MESSAGES, -1)
                    await r.expire(key, SESSION_TTL_SECONDS)
                return

            now = time.time()
            oldest_kept = (
                select(MemoryMessage.id)
                .where(MemoryMessage.phone_number == phone_number)
                .order_by(MemoryMessage.id.desc())
                .offset(HISTORY_MAX_MESSAGES - 1)
                .limit(1)
                .scalar_subquery()
            )
            await ensure_tables()
            async with database.async_session() as session:
                session.add(MemoryMessage(phone_number=phone_number, entry=json_entry, created_at=now))
                await session.flush()
                await session.execute(delete(MemoryMessage).where(
                    MemoryMessage.phone_number == phone_number,
                    or_(MemoryMessage.created_at <= now - SESSION_TTL_SECONDS,
                        MemoryMessage.id < oldest_kept),
                ))
                await session.commit()
        except Exception as exc:
            logger.error("Memory write failed (%s)", type(exc).__name__)
            if not settings.memory_fallback_allowed:
                raise MemoryUnavailable("Conversation memory is unavailable") from exc

    async def clear_history(self, phone_number: str) -> None:
        """Delete the entire conversation history for a user."""
        try:
            r = await self._get_redis()
            if r:
                await r.delete(self._key(phone_number))
                return

            await ensure_tables()
            async with database.async_session() as session:
                await session.execute(delete(MemoryMessage).where(MemoryMessage.phone_number == phone_number))
                await session.commit()
        except Exception as exc:
            logger.error("Memory clear failed (%s)", type(exc).__name__)
            if not settings.memory_fallback_allowed:
                raise MemoryUnavailable("Conversation memory is unavailable") from exc

    async def set_value(self, key: str, value: str, ttl: int) -> None:
        """Short-lived per-user state (e.g. an action awaiting YES)."""
        try:
            r = await self._get_redis()
            if r:
                await r.set(key, value, ex=ttl)
                return

            stmt = self._insert().values(key=key, value=value, expires_at=time.time() + ttl)
            stmt = stmt.on_conflict_do_update(
                index_elements=[MemoryValue.key],
                set_={"value": stmt.excluded.value, "expires_at": stmt.excluded.expires_at},
            )
            await ensure_tables()
            async with database.async_session() as session:
                await session.execute(stmt)
                await session.commit()
        except Exception as exc:
            logger.error("Value write failed (%s)", type(exc).__name__)

    async def get_value(self, key: str) -> Optional[str]:
        """Read a short-lived value without deleting it."""
        try:
            r = await self._get_redis()
            if r:
                return await r.get(key)

            await ensure_tables()
            async with database.async_session() as session:
                return await session.scalar(select(MemoryValue.value).where(
                    MemoryValue.key == key, MemoryValue.expires_at > time.time()))
        except Exception as exc:
            logger.error("Value read failed (%s)", type(exc).__name__)
            return None

    async def pop_value(self, key: str) -> Optional[str]:
        """Read and delete in one step, so a value is only ever acted on once."""
        try:
            r = await self._get_redis()
            if r:
                return await r.getdel(key)

            await ensure_tables()
            async with database.async_session() as session:
                value = await session.scalar(delete(MemoryValue).where(
                    MemoryValue.key == key, MemoryValue.expires_at > time.time()
                ).returning(MemoryValue.value))
                await session.commit()
            return value
        except Exception as exc:
            logger.error("Value read failed (%s)", type(exc).__name__)
            return None

    async def mark_latest(self, phone_number: str, message_id: str) -> None:
        """Record the newest inbound message so older in-flight replies can be dropped."""
        await self.set_value(f"astra:latest:{phone_number}", message_id, ttl=600)

    async def is_latest(self, phone_number: str, message_id: str) -> bool:
        """False once the user has sent something newer. Fails open so replies never vanish on errors."""
        return await self.get_value(f"astra:latest:{phone_number}") in (None, message_id)

    async def claim_once(self, key: str, ttl: int) -> bool:
        """True only for the first caller within `ttl` seconds, shared across instances."""
        try:
            r = await self._get_redis()
            if r:
                return bool(await r.set(f"astra:once:{key}", 1, nx=True, ex=ttl))

            # Insert, or take over an expired row; a live row returns nothing, so the claim fails.
            now = time.time()
            stmt = self._insert().values(key=f"astra:once:{key}", value="1", expires_at=now + ttl)
            stmt = stmt.on_conflict_do_update(
                index_elements=[MemoryValue.key],
                set_={"value": stmt.excluded.value, "expires_at": stmt.excluded.expires_at},
                where=MemoryValue.expires_at <= now,
            ).returning(MemoryValue.key)
            await ensure_tables()
            async with database.async_session() as session:
                claimed = (await session.execute(stmt)).first() is not None
                # Called on every inbound message, so it also sweeps expired values.
                await session.execute(delete(MemoryValue).where(MemoryValue.expires_at <= now))
                await session.commit()
            return claimed
        except Exception as exc:
            logger.error("Once-per-key check failed (%s)", type(exc).__name__)
            return True

    async def first_today(self, key: str) -> bool:
        """True only for the first call per key in a rolling 24h window, shared across instances."""
        return await self.claim_once(key, SESSION_TTL_SECONDS)

    async def close(self) -> None:
        """Close the Redis connection."""
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None


memory_service = MemoryService()
