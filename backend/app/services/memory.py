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

    async def close(self) -> None:
        """Close the Redis connection."""
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None


memory_service = MemoryService()
