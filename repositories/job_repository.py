import logging
from datetime import UTC, datetime

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

    async def mark_running(self, job_id: str, stage: str) -> None:
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": JobStatus.RUNNING.value, "stage": stage, "started_at": datetime.now(UTC)}},
        )

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

    async def fail_interrupted_statement_jobs(self, error_message: str) -> list[str]:
        """Marks every still-QUEUED/RUNNING statement job FAILED and returns
        their statement ids. Only valid at process startup: jobs run in-process
        (fastapi BackgroundTasks, one uvicorn worker - see the Dockerfile), so
        any job still "in flight" when the process starts was killed with the
        previous one and would otherwise poll as running forever."""
        query = {
            "job_type": JobType.STATEMENT_PROCESSING.value,
            "status": {"$in": [JobStatus.QUEUED.value, JobStatus.RUNNING.value]},
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
