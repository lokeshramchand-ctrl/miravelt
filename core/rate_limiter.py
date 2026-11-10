from fastapi import FastAPI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from core.config import settings

# Backed by Redis when REDIS_URI is configured so limits are shared across
# every backend replica behind a load balancer. SlowAPI's in-memory default
# counts requests per-process - harmless with exactly one instance, but it
# silently stops enforcing any real limit the moment this app runs as more
# than one (the shape actually needed once traffic justifies horizontal
# scaling). storage_uri=None falls back to in-memory automatically, so
# single-instance/local dev needs no Redis to work.
def rate_limit_key(request) -> str:
    """Authenticated requests are bucketed per user (mobile carriers put many
    users behind one CGNAT IP); everything else per client IP. Behind a proxy
    the IP is only real if uvicorn trusts it (FORWARDED_ALLOW_IPS)."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            # Signature-verified, so a forged "sub" can't pick someone else's bucket.
            from core.jwt_auth import decode_access_token
            claims = decode_access_token(auth[7:])
            if claims.get("sub"):
                return f"user:{claims['sub']}"
        except Exception:
            pass
    return get_remote_address(request)


limiter = Limiter(
    key_func=rate_limit_key,
    default_limits=["1000/day", "100/minute"],
    storage_uri=settings.REDIS_URI or None,
)

def setup_rate_limiting(app: FastAPI):
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
