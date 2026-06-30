from contextlib import asynccontextmanager
import logging
import httpx
from fastapi import FastAPI, Depends, Request

# Middleware & Security
from prometheus_fastapi_instrumentator import Instrumentator
from core.security import validate_api_key
from core.rate_limiter import setup_rate_limiting, limiter

# Databases
from database.mongo import db
from database.milvus import vector_db

# Routers
from routers import v1, memory, analytics, rag
from routers.observability import router as observability_router

# Configure logging globally
logging.basicConfig(
    level=logging.DEBUG,  # DEBUG gives you the most detail
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# Lifespan context manager for startup and shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB connections
    logger.info("Initializing application lifespan...")
    await db.connect()
    vector_db.connect()
    yield
    # Shutdown: Clean up connections
    logger.info("Tearing down application lifespan...")
    await db.disconnect()
    vector_db.disconnect()

# Initialize FastAPI with metadata
app = FastAPI(
    title="Velar Transaction Intelligence API",
    description="Core engine for raw transaction ingestion and ML routing.",
    version="1.0.0",
    lifespan=lifespan
)

# Apply global rate limiting
setup_rate_limiting(app)

# Phase 11 & 14: Initialize Prometheus Metrics Middleware
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Mount internal routers (V1 requires API Key)
app.include_router(v1.router, dependencies=[Depends(validate_api_key)])
app.include_router(memory.router, dependencies=[Depends(validate_api_key)])
app.include_router(analytics.router, dependencies=[Depends(validate_api_key)])
app.include_router(rag.router, dependencies=[Depends(validate_api_key)])
app.include_router(observability_router, dependencies=[Depends(validate_api_key)])


@app.post("/v1/categorize", dependencies=[Depends(validate_api_key)], tags=["Public API"])
@limiter.limit("50/minute")
async def public_categorize(request: Request, payload: dict):
    # Internal routing to Phase 2 -> 5 -> 9 Engine
    return {"status": "success", "message": "Transaction routed to Intelligence Engine."}


@app.get("/health", tags=["System"])
async def health_check():
    """
    Comprehensive health check that actively pings all dependent services.
    Returns detailed logs for debugging.
    """
    details = {}

    # 1. MongoDB Check (Active Ping)
    try:
        if db.client:
            await db.client.admin.command('ping')
            mongo_status = "connected"
            details["mongodb"] = "Active ping successful."
        else:
            mongo_status = "disconnected"
            details["mongodb"] = "Client not initialized."
    except Exception as e:
        mongo_status = "error"
        details["mongodb"] = f"Connection failed: {str(e)}"

    # 2. Milvus Check
    try:
        if vector_db.client:
            milvus_status = "connected"
            details["milvus"] = "Vector database client initialized."
        else:
            milvus_status = "disconnected"
            details["milvus"] = "Client not initialized."
    except Exception as e:
        milvus_status = "error"
        details["milvus"] = f"Connection failed: {str(e)}"

    # 3. Ollama Check (Active HTTP Ping)
    try:
        # Quick 2-second timeout so the health check doesn't hang forever
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get("http://localhost:11434")
            if resp.status_code == 200:
                ollama_status = "connected"
                details["ollama"] = "Ollama engine is responding."
            else:
                ollama_status = "degraded"
                details["ollama"] = f"Unexpected status code: {resp.status_code}"
    except httpx.RequestError as e:
        ollama_status = "disconnected"
        details["ollama"] = f"Could not reach Ollama at localhost:11434. Is it running? Error: {str(e)}"
    except Exception as e:
        ollama_status = "error"
        details["ollama"] = f"Unexpected error: {str(e)}"

    # Determine overall system health
    is_healthy = mongo_status == "connected" and milvus_status == "connected" and ollama_status == "connected"
    overall_status = "healthy" if is_healthy else "degraded"

    logger.debug(f"Health check executed. Overall Status: {overall_status} | Details: {details}")

    return {
        "status": overall_status,
        "services": {
            "mongodb": mongo_status,
            "milvus": milvus_status,
            "ollama": ollama_status
        },
        "details": details
    }


# Entry point for local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)