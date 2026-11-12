import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from behaviour.behavior_engine import behavior_engine
from core.rate_limiter import limiter
from database.mongo import db
from embeddings.generate_embeddings import embedding_generator
from embeddings.vectorizer import vectorizer
from milvus.insert_vectors import vector_store
from models.schemas import BehaviorPattern

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/pipelines", tags=["Batch Pipelines"])


class MerchantRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    merchant_name: str = Field(..., min_length=1, max_length=200)


@router.post("/behavior/run")
@limiter.limit("30/minute")
async def run_behavior_profiling(request: Request, payload: MerchantRequest):
    """Profiles one user's behaviour toward one merchant. Writes to `behavior_patterns`."""
    try:
        return await behavior_engine.profile_merchant_behavior(payload.user_id, payload.merchant_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/behavior/run-all")
@limiter.limit("10/minute")
async def run_behavior_profiling_all(request: Request):
    """Rebuilds every user's behaviour profiles (per user, never pooled -
    PROJECT_AUDIT.md A2). Statement processing already profiles the
    merchants it touches; this is the catch-up/rebuild path."""
    user_ids = [u for u in await db.transactions.distinct("user_id") if u and u != "system_user"]
    profiled = 0
    for user_id in user_ids:
        profiled += await behavior_engine.profile_user(user_id)
    return {"users": len(user_ids), "profiled": profiled}


@router.post("/embeddings/sync")
@limiter.limit("10/minute")
async def sync_embeddings(request: Request):
    """
    Generates and stores Milvus embeddings for every persisted behavior pattern
    (Phase 7). The vectors are read by the clustering experiment in labs/ -
    /v1/explain no longer uses them (it reads the caller's own history).
    Rate-limited: this is an O(all behavior patterns) batch job making one
    Ollama embedding call per document, not a per-request operation.
    """
    if vector_store.client is None:
        raise HTTPException(status_code=503, detail="Milvus is not connected.")

    docs = [doc async for doc in db.behavior_patterns.find()]
    synced, failed = [], []
    for doc in docs:
        merchant_name = doc.get("merchant_name", "Unknown")
        try:
            doc["_id"] = str(doc["_id"])
            pattern = BehaviorPattern(**doc)
            text = vectorizer.stringify_behavior(pattern)
            vector = await embedding_generator.generate(text)
            vector_store.insert_behavior_vector(
                pattern_id=pattern.id,
                merchant_name=pattern.merchant_name,
                vector=vector,
            )
            synced.append(merchant_name)
        except Exception as e:
            logger.warning(f"Embedding sync failed for '{merchant_name}': {e}")
            failed.append(merchant_name)
    return {"synced": synced, "failed": failed}
