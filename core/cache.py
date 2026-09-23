import json
import logging
from collections.abc import Callable
from functools import wraps
from typing import Any

import redis.asyncio as aioredis

from core.config import settings

logger = logging.getLogger(__name__)


class CacheClient:
    """
    Thin async Redis wrapper for cache-aside reads on expensive endpoints
    (routers/analytics.py). Degrades the same way Milvus/Ollama do
    elsewhere in this app (database/milvus.py, core/ollama_client.py): an
    unreachable or unconfigured Redis makes every call a no-op cache miss,
    never an error the caller has to handle - a cache is an optimization
    this app can't afford to crash on.
    """

    def __init__(self):
        self._client: aioredis.Redis | None = None

    def connect(self) -> None:
        if not settings.REDIS_URI or not settings.CACHE_ENABLED:
            return
        try:
            # from_url() doesn't open a connection itself - it's created
            # lazily on first command, so this can't block/fail startup the
            # way a synchronous connect() would.
            self._client = aioredis.from_url(settings.REDIS_URI, decode_responses=True)
            logger.info("Redis cache client configured.")
        except Exception:
            logger.warning("Failed to configure Redis client - caching disabled.", exc_info=True)
            self._client = None

    async def disconnect(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def get_json(self, key: str) -> Any | None:
        if self._client is None:
            return None
        try:
            raw = await self._client.get(key)
            return json.loads(raw) if raw is not None else None
        except Exception:
            logger.warning("Redis GET failed for key=%s - treating as cache miss.", key, exc_info=True)
            return None

    async def set_json(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        if self._client is None:
            return
        try:
            await self._client.set(key, json.dumps(value, default=str), ex=ttl_seconds or settings.CACHE_DEFAULT_TTL_SECONDS)
        except Exception:
            logger.warning("Redis SET failed for key=%s - continuing without caching it.", key, exc_info=True)

    async def delete(self, *keys: str) -> None:
        if self._client is None or not keys:
            return
        try:
            await self._client.delete(*keys)
        except Exception:
            logger.warning("Redis DELETE failed for keys=%s.", keys, exc_info=True)

    @property
    def is_connected(self) -> bool:
        return self._client is not None


cache = CacheClient()


def cached(key_builder: Callable[..., str], ttl_seconds: int | None = None):
    """
    Cache-aside decorator for GET-style FastAPI handlers. `key_builder`
    receives the handler's resolved keyword arguments (FastAPI always calls
    route handlers with kwargs matching parameter names, including resolved
    `Depends(...)` values) and must return a cache key that's a pure
    function of whatever actually varies the response - same discipline any
    HTTP cache key needs.

    Must be applied *below* `@router.get(...)` (i.e. closer to the function)
    so FastAPI's route registration sees the wrapped function - `functools.
    wraps` preserves `__wrapped__`, which `inspect.signature` (what FastAPI
    uses to resolve dependencies) follows back to the original signature,
    `Depends(...)` defaults included.
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not cache.is_connected:
                return await func(*args, **kwargs)

            key = key_builder(**kwargs)
            hit = await cache.get_json(key)
            if hit is not None:
                return hit

            result = await func(*args, **kwargs)
            await cache.set_json(key, result, ttl_seconds)
            return result

        return wrapper

    return decorator
