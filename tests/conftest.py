"""Shared fixtures for tests/.

Unit tests (test_recurring.py, test_fact_check.py, ...) need nothing from
here. Integration tests need the same live MongoDB + Redis as test_api.py
(see CLAUDE.md for the env vars) and use the `client` and `make_user`
fixtures below.
"""
import contextlib
import uuid
from datetime import date

import pytest

from core.config import settings

API_HEADERS = {"X-Miravelt-API-Key": settings.MIRAVELT_API_KEY}


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    from core.rate_limiter import limiter

    with contextlib.suppress(Exception):
        limiter.reset()
    yield


@pytest.fixture
def make_user(client):
    from core.jwt_auth import create_access_token

    def _make():
        # Straight through the repository: registering over HTTP is rate
        # limited (5/minute), and several tests need a handful of users.
        from core.security import hash_password
        from repositories.user_repository import user_repo

        email = f"t_{uuid.uuid4().hex[:12]}@example.com"
        user = client.portal.call(user_repo.create_user, email, hash_password("StrongPassword123!"))
        token, _ = create_access_token(user.id)
        return {
            "id": user.id,
            "email": email,
            "password": "StrongPassword123!",
            "headers": {**API_HEADERS, "Authorization": f"Bearer {token}"},
        }

    return _make


@pytest.fixture
def ingest(client):
    """Creates a statement for `user` from synthetic text and runs the real
    processing pipeline on it, exactly as the Celery worker would."""
    from models.schemas import Job, JobType, Statement
    from repositories.job_repository import job_repo
    from repositories.statement_repository import statement_repo
    from statements.pdf_parser import statement_parser
    from statements.statement_service import statement_service

    def _ingest(user: dict, text: str, filename: str = "synthetic.pdf") -> str:
        start, end = statement_parser.parse_period(text)
        sent, received = statement_parser.parse_declared_totals(text)

        async def _create() -> tuple[str, str]:
            statement = await statement_repo.create(Statement(
                user_id=user["id"], original_filename=filename, file_size_bytes=len(text),
                period_start=start, period_end=end, declared_sent_amount=sent, declared_received_amount=received,
                content_sha256=uuid.uuid4().hex,
            ))
            job = await job_repo.create(Job(
                user_id=user["id"], job_type=JobType.STATEMENT_PROCESSING, resource_id=statement.id,
            ))
            await statement_repo.set_job(statement.id, job.id)
            return statement.id, job.id

        statement_id, job_id = client.portal.call(_create)
        client.portal.call(statement_service.process_statement, statement_id, job_id, text)
        return statement_id

    return _ingest


def period(start: tuple[int, int, int], end: tuple[int, int, int]) -> tuple[date, date]:
    return date(*start), date(*end)
