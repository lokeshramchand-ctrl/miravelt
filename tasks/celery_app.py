"""
Celery application: task queue + beat scheduler for velar-backend's batch
pipelines (routers/pipelines.py) and the retraining-queue executor
(feedback/retraining_queue.py) - both previously manual-trigger-only, and a
TODO respectively (docs/16-known-issues-tech-debt.md §16.5).

Never imported by app.py - this runs as two separate OS processes, started
explicitly wherever this backend is deployed:

    celery -A tasks.celery_app worker --loglevel=info
    celery -A tasks.celery_app beat --loglevel=info

Requires REDIS_URI to be set; see docker-compose_local.yaml /
docker-compose_production.yaml for the `celery-worker` / `celery-beat`
service definitions that already wire this up.
"""
import asyncio
import logging
from datetime import timedelta

from celery import Celery
from celery.signals import worker_process_init, worker_process_shutdown

from core.config import settings
from database.milvus import vector_db
from database.mongo import db
from milvus.insert_vectors import vector_store

logger = logging.getLogger(__name__)

celery_app = Celery(
    "velar",
    broker=settings.REDIS_URI or "redis://localhost:6379/0",
    backend=settings.REDIS_URI or "redis://localhost:6379/0",
    include=["tasks.pipeline_tasks", "tasks.retraining_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Long-running batch jobs (clustering, embeddings sync) shouldn't be
    # silently killed mid-run, but also shouldn't hang a worker forever if
    # Mongo/Milvus/Ollama wedge - matches the "fail eventually, don't hang
    # forever" posture of this app's other timeouts (core/config.py's
    # MONGODB_*_TIMEOUT_MS).
    task_soft_time_limit=1800,
    task_time_limit=2100,
)

celery_app.conf.beat_schedule = {
    "pipeline-behavior-run-all": {
        "task": "tasks.pipeline_tasks.run_behavior_profiling_all",
        "schedule": timedelta(minutes=settings.PIPELINE_BEHAVIOR_INTERVAL_MINUTES),
    },
    "pipeline-embeddings-sync": {
        "task": "tasks.pipeline_tasks.sync_embeddings",
        "schedule": timedelta(minutes=settings.PIPELINE_EMBEDDINGS_INTERVAL_MINUTES),
    },
    "pipeline-decay-sweep": {
        "task": "tasks.pipeline_tasks.run_decay_sweep",
        "schedule": timedelta(minutes=settings.PIPELINE_DECAY_INTERVAL_MINUTES),
    },
    "pipeline-graph-build": {
        "task": "tasks.pipeline_tasks.build_knowledge_graph",
        "schedule": timedelta(minutes=settings.PIPELINE_GRAPH_INTERVAL_MINUTES),
    },
    "pipeline-clustering-run": {
        "task": "tasks.pipeline_tasks.run_clustering",
        "schedule": timedelta(minutes=settings.PIPELINE_CLUSTERING_INTERVAL_MINUTES),
    },
    "retraining-queue-check": {
        "task": "tasks.retraining_tasks.check_and_trigger_retraining",
        "schedule": timedelta(minutes=settings.RETRAINING_CHECK_INTERVAL_MINUTES),
    },
}


def run_async(coro):
    """Every task body is async (Motor/Milvus client calls) - each worker
    process owns one event loop, created once at process start (see
    worker_process_init below) and reused for every task it runs, rather
    than asyncio.run() tearing connections down and rebuilding them per
    task."""
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(coro)


@worker_process_init.connect
def _init_worker(**kwargs):
    """A Celery worker is a separate OS process from the FastAPI app - it
    doesn't inherit app.py's event loop or DB connections, so it needs its
    own, set up once per forked worker process rather than per task."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(db.connect(uri=settings.MONGODB_URI, db_name=settings.MONGODB_DB_NAME))
    vector_db.connect(uri=settings.MILVUS_URI)
    if vector_db.client is not None:
        vector_store.ensure_collections()
    else:
        logger.warning(
            "Celery worker: Milvus unreachable at startup - vector-dependent "
            "tasks (embeddings sync, clustering) will fail until it recovers."
        )


@worker_process_shutdown.connect
def _shutdown_worker(**kwargs):
    loop = asyncio.get_event_loop()
    loop.run_until_complete(db.disconnect())
    vector_db.disconnect()
