from fastapi import FastAPI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from core.config import settings

# Backed by Redis when REDIS_URI is configured so limits are shared across
# every backend replica behind a load balancer. SlowAPI's in-memory default
# counts requests per-process - harmless with exactly one instance, but it
# silently stops enforcing any real limit the moment this app runs as more
# than one (the shape actually needed once traffic justifies horizontal
# scaling). storage_uri=None falls back to in-memory automatically, so
# single-instance/local dev needs no Redis to work.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["1000/day", "100/minute"],
    storage_uri=settings.REDIS_URI or None,
)

def setup_rate_limiting(app: FastAPI):
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
