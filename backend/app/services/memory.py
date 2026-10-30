"""Redis-backed short-term conversation memory."""

import json
import logging
import asyncio
import time
from typing import Any, Optional

import redis.asyncio as aioredis

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SESSION_TTL_SECONDS = 24 * 60 * 60  # 24 hours
REDIS_RETRY_INTERVAL_SECONDS = 30


class MemoryUnavailable(RuntimeError):
    pass


class MemoryService:
    """Store and retrieve recent conversation history.
    
    Prefers Redis if available, falls back to a local dictionary (in-memory) 
    if Redis is disconnected.
    """

    def __init__(self, redis_client: Optional[aioredis.Redis] = None) -> None:
        self._redis = redis_client
        self._local_storage: dict[str, list[str]] = {}
        self._local_once: dict[str, float] = {}
        self._local_latest: dict[str, str] = {}
        self._local_values: dict[str, tuple[str, float]] = {}
        self._connect_lock = asyncio.Lock()
        self._retry_after = 0.0

    async def _get_redis(self) -> Optional[aioredis.Redis]:
        if self._redis is not None:
            return self._redis
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
        """Check the shared Redis connection; a local dictionary is never ready."""
        try:
            client = await self._get_redis()
            return client is not None and bool(await client.ping())
        except Exception:
            return False

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
            
            # Local fallback
            raw_messages = self._local_storage.get(phone_number, [])[-limit:]
            return [json.loads(m) for m in raw_messages]
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
                await r.rpush(key, json_entry)
                await r.ltrim(key, -50, -1)
                await r.expire(key, SESSION_TTL_SECONDS)
                return

            # Local fallback
            if phone_number not in self._local_storage:
                self._local_storage[phone_number] = []
            self._local_storage[phone_number].append(json_entry)
            self._local_storage[phone_number] = self._local_storage[phone_number][-50:]
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
            
            if phone_number in self._local_storage:
                del self._local_storage[phone_number]
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
            else:
                self._local_values[key] = (value, time.time() + ttl)
        except Exception as exc:
            logger.error("Value write failed (%s)", type(exc).__name__)

    async def pop_value(self, key: str) -> Optional[str]:
        """Read and delete in one step, so a value is only ever acted on once."""
        try:
            r = await self._get_redis()
            if r:
                return await r.getdel(key)
            value, expires = self._local_values.pop(key, (None, 0))
            return value if time.time() < expires else None
        except Exception as exc:
            logger.error("Value read failed (%s)", type(exc).__name__)
            return None

    async def mark_latest(self, phone_number: str, message_id: str) -> None:
        """Record the newest inbound message so older in-flight replies can be dropped."""
        try:
            r = await self._get_redis()
            if r:
                await r.set(f"astra:latest:{phone_number}", message_id, ex=600)
            else:
                self._local_latest[phone_number] = message_id
        except Exception as exc:
            logger.error("Latest-message write failed (%s)", type(exc).__name__)

    async def is_latest(self, phone_number: str, message_id: str) -> bool:
        """False once the user has sent something newer. Fails open so replies never vanish on errors."""
        try:
            r = await self._get_redis()
            latest = await r.get(f"astra:latest:{phone_number}") if r else self._local_latest.get(phone_number)
            return latest in (None, message_id)
        except Exception as exc:
            logger.error("Latest-message read failed (%s)", type(exc).__name__)
            return True

    async def first_today(self, key: str) -> bool:
        """True only for the first call per key in a rolling 24h window, shared across instances."""
        try:
            r = await self._get_redis()
            if r:
                return bool(await r.set(f"astra:once:{key}", 1, nx=True, ex=SESSION_TTL_SECONDS))

            # Local fallback
            now = time.time()
            if now - self._local_once.get(key, 0) < SESSION_TTL_SECONDS:
                return False
            self._local_once[key] = now
            return True
        except Exception as exc:
            # Fail open: one extra paid message beats a user stuck in silence.
            logger.error("Once-per-day check failed (%s)", type(exc).__name__)
            return True

    async def close(self) -> None:
        """Close the Redis connection."""
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None


memory_service = MemoryService()
