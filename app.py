import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Middleware & Security
from prometheus_fastapi_instrumentator import Instrumentator

# Settings
from core.cache import cache
from core.config import settings
from core.error_handlers import register_exception_handlers
from core.middleware import BodySizeLimitMiddleware, HTTPSEnforcementMiddleware, RequestIDMiddleware, SecurityHeadersMiddleware
from core.ollama_client import get_ollama_host
from core.rate_limiter import setup_rate_limiting
from core.security import validate_admin_key, validate_api_key
from database.milvus import vector_db

# Databases
from database.mongo import db
from feedback.api_router import router as feedback_router
from milvus.insert_vectors import vector_store

# Routers
from routers import admin, analytics, app_updates, auth, devices, jobs, memory, pipelines, rag, statements, users, v1
from routers.observability import router as observability_router

# Logging
# LOG_LEVEL defaults to INFO (never DEBUG by default): at DEBUG, pymongo/motor
# log full command payloads, including raw transaction documents - amounts,
# merchants, user ids. That's inappropriate for a service handling real
# financial data outside of a deliberate, opt-in local debugging session.
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


# Shared client for outbound health-check calls to Ollama. Built once at
# startup and reused for the app's lifetime - constructing a fresh
# httpx.AsyncClient() per /health request (its own connection pool + TLS
# context) serializes badly under concurrent load, observed as 10s+ p50
# latency and read timeouts during a 50-concurrent stress test.
_ollama_health_client: httpx.AsyncClient | None = None

# Background task that keeps retrying the Milvus connection after startup.
# vector_db.connect() only gets a handful of retries (~15s total) so a
# slow-starting Milvus container - its Docker healthcheck has a 90s
# start_period - doesn't block app startup. Without this, a backend that
# wins that race permanently reports "milvus": "disconnected" until someone
# manually restarts it, even once Milvus itself becomes healthy.
_milvus_reconnect_task: asyncio.Task | None = None


async def _milvus_reconnect_loop(uri: str, interval: int = 15):
    while vector_db.client is None:
        await asyncio.sleep(interval)
        logger.info("Retrying Milvus connection in background...")
        # connect() blocks on network I/O + time.sleep - run it off the event
        # loop so it can't stall request handling while it retries.
        await asyncio.to_thread(vector_db.connect, uri, 1, 0)
        if vector_db.client is not None:
            vector_store.ensure_collections()
            logger.info("Milvus reconnected successfully in background.")


# Lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing application lifespan...")

    # MongoDB
    await db.connect(uri=settings.MONGODB_URI, db_name=settings.MONGODB_DB_NAME)
    await db.ensure_indexes()

    # Milvus
    vector_db.connect(uri=settings.MILVUS_URI)
    vector_store.ensure_collections()

    global _milvus_reconnect_task
    if vector_db.client is None:
        logger.warning("Milvus unreachable at startup; will keep retrying in the background.")
        _milvus_reconnect_task = asyncio.create_task(_milvus_reconnect_loop(settings.MILVUS_URI))

    global _ollama_health_client
    _ollama_health_client = httpx.AsyncClient(timeout=2.0)

    # Redis (core/cache.py) - response caching for routers/analytics.py and
    # shared rate-limit storage (core/rate_limiter.py). Optional: an unset
    # REDIS_URI leaves cache.connect() a no-op, same degrade-not-crash
    # posture as Milvus/Ollama above.
    cache.connect()

    yield

    logger.info("Tearing down application lifespan...")
    if _milvus_reconnect_task is not None:
        _milvus_reconnect_task.cancel()
    await db.disconnect()
    vector_db.disconnect()
    await _ollama_health_client.aclose()
    await cache.disconnect()


# FastAPI App
app = FastAPI(
    title="Velar",
    description="Core engine for raw transaction ingestion and ML routing.",
    version="1.0.0",
    lifespan=lifespan
)

# Centralized error handling - every error response (expected or not) comes
# back as the same JSON envelope, and unhandled exceptions never leak
# internal detail to the client (full detail is always logged server-side).
register_exception_handlers(app)

# Rate Limiting
setup_rate_limiting(app)

# Defensive middleware. Added in this order so that, relative to the ASGI
# stack (last-added = outermost), RequestIDMiddleware wraps everything else -
# even a request rejected by the body-size limiter gets a correlation id back.
if settings.ENFORCE_HTTPS and settings.ENVIRONMENT != "development":
    app.add_middleware(HTTPSEnforcementMiddleware, enabled_for_environment=settings.ENVIRONMENT)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.MAX_REQUEST_BODY_BYTES)
app.add_middleware(RequestIDMiddleware)

# CORS - added last so it's outermost (last-added = outermost, see comment
# above), letting it answer preflight OPTIONS requests and attach headers to
# every response, including one rejected by an inner middleware. Was a
# config-only field until now (docs/17-senior-architect-review.md §6);
# real once a browser-based client - the admin dashboard - started calling
# this API directly. No origins configured means no CORSMiddleware at all,
# same "closed by default" posture as ADMIN_API_KEY above.
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Prometheus Metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics")


# Routers (secured)
# Every router is mounted behind the shared X-Velar-API-Key dependency,
# regardless of whether any of its handlers also require a per-user JWT
# (core/jwt_auth.py::get_current_user, applied at the handler level where
# needed - see routers/auth.py, routers/v1.py, routers/analytics.py,
# feedback/api_router.py). The API key authenticates the calling
# application; JWT authenticates the end user within it. A JWT alone, without
# the API key, is rejected here before a handler ever runs.
#
# pipelines.router is the one exception: its handlers take no per-user JWT
# at all (they're system-wide batch jobs, not scoped to a user), so
# VELAR_API_KEY alone - shipped inside every client app binary - isn't a
# safe gate for them. It gets an additional validate_admin_key dependency
# on top, gated by a separate operator-only secret (see core/security.py).
app.include_router(auth.router, dependencies=[Depends(validate_api_key)])
app.include_router(devices.router, dependencies=[Depends(validate_api_key)])
app.include_router(users.router, dependencies=[Depends(validate_api_key)])
app.include_router(v1.router, dependencies=[Depends(validate_api_key)])
app.include_router(memory.router, dependencies=[Depends(validate_api_key)])
app.include_router(analytics.router, dependencies=[Depends(validate_api_key)])
app.include_router(rag.router, dependencies=[Depends(validate_api_key)])
app.include_router(observability_router, dependencies=[Depends(validate_api_key)])
app.include_router(feedback_router, dependencies=[Depends(validate_api_key)])
app.include_router(pipelines.router, dependencies=[Depends(validate_api_key), Depends(validate_admin_key)])
app.include_router(statements.router, dependencies=[Depends(validate_api_key)])
app.include_router(jobs.router, dependencies=[Depends(validate_api_key)])
# routers/app_updates.py: GET routes need only VELAR_API_KEY (read-only
# version metadata + the APK bytes); POST /app/releases layers
# validate_admin_key on top of that at the route level (see the router
# itself) since publishing a build is what actually reaches every installed
# device - same posture as pipelines.router above, applied per-route instead
# of per-router because most of this router's endpoints are meant to be
# reachable by the app itself, unlike pipelines.router's.
app.include_router(app_updates.router, dependencies=[Depends(validate_api_key)])

# Admin API - stricter rate limits, requires ADMIN_API_KEY + admin scope
# In production, can be deployed on a separate internal port/network (see docker-compose.yml)
app.include_router(admin.router, dependencies=[Depends(validate_api_key)])


# --- Health / Liveness / Readiness ---
# Split per k8s-style convention: liveness answers "is the process alive"
# (cheap, no dependency calls - a hung dependency should never fail liveness
# and trigger a restart-loop that won't fix anything). Readiness answers "can
# this instance actually serve traffic" (checks dependencies, used to gate
# load balancer / rollout traffic). Both are intentionally unauthenticated,
# matching standard orchestrator health-check conventions, but - unlike the
# original /health - never return raw exception text, only a coarse status,
# so they can't leak internal topology (hostnames, connection errors) to an
# unauthenticated caller. /health is kept exactly as it was for backward
# compatibility with any existing monitoring pointed at it, with the same
# info-leak fixed in place.

async def _check_dependencies() -> tuple[str, dict, dict]:
    services = {}
    details = {}

    try:
        if db.client:
            await db.client.admin.command("ping")
            services["mongodb"] = "connected"
            details["mongodb"] = "Active ping successful."
        else:
            services["mongodb"] = "disconnected"
            details["mongodb"] = "Client not initialized."
    except Exception:
        logger.exception("Dependency check: MongoDB ping failed")
        services["mongodb"] = "error"
        details["mongodb"] = "MongoDB health check failed - see server logs."

    try:
        if vector_db.client:
            services["milvus"] = "connected"
            details["milvus"] = "Client initialized."
        else:
            services["milvus"] = "disconnected"
            details["milvus"] = "Client not initialized."
    except Exception:
        logger.exception("Dependency check: Milvus check failed")
        services["milvus"] = "error"
        details["milvus"] = "Milvus health check failed - see server logs."

    try:
        resp = await _ollama_health_client.get(get_ollama_host())
        if resp.status_code == 200:
            services["ollama"] = "connected"
            details["ollama"] = "Ollama engine responding."
        else:
            services["ollama"] = "degraded"
            details["ollama"] = f"Status code: {resp.status_code}"
    except Exception:
        logger.exception("Dependency check: Ollama check failed")
        services["ollama"] = "error"
        details["ollama"] = "Ollama health check failed - see server logs."

    # Informational only, like Milvus/Ollama above - caching and the
    # scheduler/task queue (tasks/celery_app.py) both degrade to "disabled"
    # rather than the app failing, so Redis never gates /ready either.
    if not settings.REDIS_URI:
        services["redis"] = "not_configured"
        details["redis"] = "REDIS_URI unset - caching, distributed rate limiting, and the Celery task queue/scheduler are disabled."
    elif cache.is_connected:
        services["redis"] = "connected"
        details["redis"] = "Cache client configured."
    else:
        services["redis"] = "error"
        details["redis"] = "REDIS_URI set but client failed to initialize - see server logs."

    overall_status = "healthy" if all(v in ("connected", "not_configured") for v in services.values()) else "degraded"
    return overall_status, services, details


@app.get("/live", tags=["System"])
async def liveness():
    return {"status": "alive"}


@app.get("/ready", tags=["System"])
async def readiness():
    _, services, _ = await _check_dependencies()
    # MongoDB is this app's one hard dependency for correctness (every write
    # path needs it); Milvus/Ollama degrade specific features gracefully
    # (see rag/retriever.py, milvus/insert_vectors.py) rather than failing
    # the whole app, so they don't gate readiness.
    is_ready = services.get("mongodb") == "connected"
    return JSONResponse(
        status_code=200 if is_ready else 503,
        content={"status": "ready" if is_ready else "not_ready", "services": services},
    )


@app.get("/health", tags=["System"])
async def health_check():
    overall_status, services, details = await _check_dependencies()
    return {"status": overall_status, "services": services, "details": details}


# Local Dev Entry Point
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",  # noqa: S104 - intentional: must accept connections from outside the container/network namespace, not just localhost
        port=8000,
        reload=(settings.ENVIRONMENT == "development"),
    )
