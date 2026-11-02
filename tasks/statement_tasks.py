"""Celery tasks for statement processing, replacing the in-process FastAPI
BackgroundTasks it used to run under (routers/statements.py). Moving this
here removes the "exactly one backend process" constraint ARCHITECTURE.md
used to document - multiple backend API replicas are now safe, since none
of them execute statement processing themselves, only enqueue it (see
tasks/celery_app.py's module docstring for the import-vs-execution split).

Routed to its own "statements" queue (tasks/celery_app.py's task_routes),
separate from the batch-pipeline tasks' default queue, each with its own
`celery worker` process (docker-compose_*.yaml) - so a burst of uploads
never delays a scheduled clustering run, and vice versa.
"""
import logging

from core.config import settings
from repositories.job_repository import job_repo
from repositories.statement_repository import statement_repo
from statements.statement_service import statement_service
from tasks.celery_app import celery_app, run_async

logger = logging.getLogger(__name__)


@celery_app.task(
    name="tasks.statement_tasks.process_statement_task",
    acks_late=True,
    # If the worker process dies mid-task (OOM, hard time-limit kill), the
    # broker redelivers rather than silently losing the job - paired with
    # statement_service.process_statement's atomic job-claim (QUEUED ->
    # RUNNING), so a redelivered task either claims an un-started job or is
    # a safe no-op if the original attempt already got far enough to mark it
    # RUNNING (see that function's docstring for why it isn't retried there).
    task_reject_on_worker_lost=True,
    # Tighter than the batch pipelines' global 1800s/2100s
    # (tasks/celery_app.py) - a real user is waiting on this one, so a stuck
    # statement should fail in minutes, not half an hour.
    soft_time_limit=600,
    time_limit=900,
)
def process_statement_task(statement_id: str, job_id: str, full_text: str):
    return run_async(statement_service.process_statement(statement_id, job_id, full_text))


async def _sweep_stale_statement_jobs() -> dict:
    message = (
        "Processing did not finish in time and was marked failed by the stale-job sweep. "
        "Please upload this statement again."
    )
    statement_ids = await job_repo.fail_stale_running_jobs(
        settings.STATEMENT_STALE_JOB_TIMEOUT_MINUTES, message
    )
    for statement_id in statement_ids:
        await statement_repo.mark_failed(statement_id, message)
    if statement_ids:
        logger.warning("Stale-job sweep failed %d stuck statement job(s): %s", len(statement_ids), statement_ids)
    return {"failed_count": len(statement_ids)}


@celery_app.task(name="tasks.statement_tasks.sweep_stale_statement_jobs")
def sweep_stale_statement_jobs():
    return run_async(_sweep_stale_statement_jobs())
