"""
Celery tasks wrapping routers/pipelines.py's batch jobs so tasks/celery_app.
py's beat schedule can run them automatically, on top of (not instead of)
the existing manual POST /v1/pipelines/* endpoints. Each task calls the
exact same engine/manager function the HTTP handler calls - this is a
second entry point into the same logic, never a second implementation of
it (ARCHITECTURE.md §2: each domain responsibility has exactly one home).
"""
import logging

from behaviour.behavior_engine import behavior_engine
from database.mongo import db
from embeddings.generate_embeddings import embedding_generator
from embeddings.vectorizer import vectorizer
from graphs.graph_builder import graph_engine
from memory.decay_engine import decay_engine
from milvus.insert_vectors import vector_store
from models.schemas import BehaviorPattern
from tasks.celery_app import celery_app, run_async

logger = logging.getLogger(__name__)


async def _run_behavior_profiling_all() -> dict:
    merchant_names = await db.transactions.distinct("merchant")
    profiled, failed = [], []
    for name in merchant_names:
        if not name or name == "Unknown":
            continue
        try:
            await behavior_engine.profile_merchant_behavior(name)
            profiled.append(name)
        except Exception as e:
            logger.warning(f"Behavior profiling failed for '{name}': {e}")
            failed.append(name)
    return {"profiled": len(profiled), "failed": len(failed)}


@celery_app.task(name="tasks.pipeline_tasks.run_behavior_profiling_all")
def run_behavior_profiling_all():
    return run_async(_run_behavior_profiling_all())


async def _sync_embeddings() -> dict:
    if vector_store.client is None:
        logger.warning("Embeddings sync skipped: Milvus not connected.")
        return {"synced": 0, "failed": 0, "skipped": "milvus_unreachable"}

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
    return {"synced": len(synced), "failed": len(failed)}


@celery_app.task(name="tasks.pipeline_tasks.sync_embeddings")
def sync_embeddings():
    return run_async(_sync_embeddings())


async def _run_decay_sweep() -> dict:
    archived_count = await decay_engine.run_archive_sweep()
    return {"archived_count": archived_count}


@celery_app.task(name="tasks.pipeline_tasks.run_decay_sweep")
def run_decay_sweep():
    return run_async(_run_decay_sweep())


@celery_app.task(name="tasks.pipeline_tasks.build_knowledge_graph")
def build_knowledge_graph():
    return run_async(graph_engine.build_graph())


@celery_app.task(name="tasks.pipeline_tasks.run_clustering")
def run_clustering():
    # Imported lazily, matching routers/pipelines.py::run_clustering - a
    # missing/broken scikit-learn or umap-learn install only breaks this
    # one task, not worker startup.
    from clustering.cluster_engine import cluster_engine
    return run_async(cluster_engine.run_discovery_pipeline())
