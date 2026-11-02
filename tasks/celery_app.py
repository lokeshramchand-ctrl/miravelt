"""
Celery application: task queue + beat scheduler for miravelt-backend's batch
pipelines (routers/pipelines.py), the retraining-queue executor
(feedback/retraining_queue.py), and statement processing
(tasks/statement_tasks.py, dispatched from routers/statements.py).

This module *is* imported by the API process now (transitively, via
routers/statements.py -> tasks.statement_tasks -> here) so it can call
`.delay()` to enqueue a statement for processing - that's a lightweight,
lazy-connected publish to Redis (like core/cache.py's client), not task
execution. Task *execution* - run_async(), the worker's own event loop and
Mongo/Milvus connections set up below - only ever happens in separate
`celery worker`/`celery beat` OS processes, started explicitly wherever this
backend is deployed:

    celery -A tasks.celery_app worker --loglevel=info -Q celery       # pipelines + retraining
    celery -A tasks.celery_app worker --loglevel=info -Q statements   # statement processing
    celery -A tasks.celery_app beat --loglevel=info                   # singleton - never run more than one

Two separate worker queues so a burst of statement uploads never delays a
scheduled clustering run, and vice versa (see task_routes below). Requires
REDIS_URI to be set (now a hard dependency - core/config.py); see
docker-compose_local.yaml / docker-compose_production.yaml for the
`celery-worker` / `celery-worker-statements` / `celery-beat` service
definitions that already wire this up.
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
    "miravelt",
    broker=settings.REDIS_URI,
    backend=settings.REDIS_URI,
    include=["tasks.pipeline_tasks", "tasks.retraining_tasks", "tasks.statement_tasks"],
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
    # MONGODB_*_TIMEOUT_MS). Statement processing overrides this with a much
    # tighter per-task limit (tasks/statement_tasks.py) since a real user is
    # waiting on it, unlike these batch jobs.
    task_soft_time_limit=1800,
    task_time_limit=2100,
    # Keeps statement processing off the pipelines'/retraining's default
    # queue (and vice versa) - each gets its own `celery worker -Q ...`
    # process (see docker-compose_*.yaml), so load on one never delays the
    # other.
    task_routes={
        "tasks.statement_tasks.process_statement_task": {"queue": "statements"},
        "tasks.statement_tasks.sweep_stale_statement_jobs": {"queue": "statements"},
    },
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
    "statement-stale-job-sweep": {
        "task": "tasks.statement_tasks.sweep_stale_statement_jobs",
        "schedule": timedelta(minutes=settings.STATEMENT_STALE_JOB_SWEEP_INTERVAL_MINUTES),
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
