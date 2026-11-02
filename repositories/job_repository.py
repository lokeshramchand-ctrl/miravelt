import logging
from datetime import UTC, datetime, timedelta

from bson import ObjectId
from bson.errors import InvalidId

from database.mongo import db
from models.schemas import Job, JobStatus, JobType

logger = logging.getLogger(__name__)


class JobRepository:
    async def create(self, job: Job) -> Job:
        doc = job.model_dump(by_alias=True, exclude={"id"})
        result = await db.jobs.insert_one(doc)
        job.id = str(result.inserted_id)
        return job

    async def get_by_id(self, job_id: str) -> Job | None:
        try:
            oid = ObjectId(job_id)
        except (InvalidId, TypeError):
            return None
        doc = await db.jobs.find_one({"_id": oid})
        if not doc:
            return None
        doc["_id"] = str(doc["_id"])
        return Job(**doc)

    async def claim_and_mark_running(self, job_id: str, stage: str) -> bool:
        """Atomic claim: only transitions QUEUED -> RUNNING, and only the
        caller that actually performs that transition gets True back. Needed
        now that a Celery task can be redelivered after a worker crash
        (acks_late + task_reject_on_worker_lost, see
        tasks/statement_tasks.py) - a redelivered task must never reprocess
        a job another delivery already claimed (duplicate transactions)."""
        result = await db.jobs.update_one(
            {"_id": ObjectId(job_id), "status": JobStatus.QUEUED.value},
            {"$set": {"status": JobStatus.RUNNING.value, "stage": stage, "started_at": datetime.now(UTC)}},
        )
        return result.modified_count > 0

    async def update_progress(self, job_id: str, stage: str, progress_percent: int) -> None:
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"stage": stage, "progress_percent": progress_percent}},
        )

    async def mark_completed(self, job_id: str) -> None:
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "status": JobStatus.COMPLETED.value,
                    "stage": "completed",
                    "progress_percent": 100,
                    "completed_at": datetime.now(UTC),
                }
            },
        )

    async def mark_failed(self, job_id: str, error_message: str) -> None:
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "status": JobStatus.FAILED.value,
                    "error_message": error_message,
                    "completed_at": datetime.now(UTC),
                }
            },
        )

    async def fail_stale_running_jobs(self, older_than_minutes: int, error_message: str) -> list[str]:
        """Time-based replacement for the old restart-based sweep (statement
        processing used to run in-process, so an API restart meant "still
        RUNNING or QUEUED" => "was just killed" - see app.py's removed
        _fail_interrupted_statement_jobs, which checked both statuses for
        exactly that reason). Now that processing runs in separate Celery
        workers, an API restart orphans nothing; this instead catches a job
        truly abandoned, without touching one that's just taking a while -
        see tasks/statement_tasks.py::sweep_stale_statement_jobs, which calls
        this periodically via Celery beat. Two distinct ways a job gets
        abandoned, both covered:
        - RUNNING past the cutoff: a worker crashed/was killed mid-task
          (statement_service.process_statement's own except-block already
          marks it FAILED on any ordinary exception - this is the backstop
          for when the worker process itself dies, not just the task).
        - QUEUED past the cutoff: the task message was never delivered to
          any worker at all (lost, or no worker listening on the
          "statements" queue) - nothing ever ran, so there was never an
          exception for anything to catch."""
        cutoff = datetime.now(UTC) - timedelta(minutes=older_than_minutes)
        query = {
            "job_type": JobType.STATEMENT_PROCESSING.value,
            "$or": [
                {"status": JobStatus.RUNNING.value, "started_at": {"$lt": cutoff}},
                {"status": JobStatus.QUEUED.value, "created_at": {"$lt": cutoff}},
            ],
        }
        statement_ids = [doc["resource_id"] async for doc in db.jobs.find(query, {"resource_id": 1})]
        if statement_ids:
            await db.jobs.update_many(
                query,
                {
                    "$set": {
                        "status": JobStatus.FAILED.value,
                        "error_message": error_message,
                        "completed_at": datetime.now(UTC),
                    }
                },
            )
        return statement_ids

    async def delete_for_resource(self, resource_id: str) -> int:
        result = await db.jobs.delete_many({"resource_id": resource_id})
        return result.deleted_count

    async def list_all(
        self,
        page: int,
        page_size: int,
        status_filter: JobStatus | None = None,
    ) -> tuple[list[Job], int]:
        """Admin-only, cross-user job listing - routers/jobs.py's GET
        /jobs/{id} is intentionally ownership-scoped instead."""
        query: dict = {}
        if status_filter is not None:
            query["status"] = status_filter.value

        total = await db.jobs.count_documents(query)
        cursor = db.jobs.find(query).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size)
        items = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            items.append(Job(**doc))
        return items, total

    async def count_by_status(self) -> dict[str, int]:
        counts = {status.value: 0 for status in JobStatus}
        async for doc in db.jobs.aggregate([{"$group": {"_id": "$status", "count": {"$sum": 1}}}]):
            counts[doc["_id"]] = doc["count"]
        return counts


job_repo = JobRepository()
