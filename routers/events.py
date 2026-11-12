"""Client events: product analytics and crash reports from the app
(PROJECT_AUDIT.md F26).

    POST /v1/events    a small batch of named events from a signed-in client

Self-hosted on purpose: a finance app that says "private by default" should
not hand usage data to a third-party SDK. Events are a name, a time and a
few scalar properties - never transaction content. `client_error` carries a
message and stack so a render crash stops being an anonymous white screen.

Documents expire after 180 days (TTL index in database/mongo.py) and are
deleted with the account (services/account_service.py).
"""
import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, Field, field_validator

from core.jwt_auth import get_current_user
from core.rate_limiter import limiter
from database.mongo import db
from models.schemas import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["Events"])

_NAME_RE = re.compile(r"^[a-z][a-z0-9_]{1,48}$")
_MAX_PROPERTIES = 20
_MAX_STRING = 300
_MAX_STACK = 4000
_Scalar = str | int | float | bool | None


class ClientEvent(BaseModel):
    name: str = Field(..., max_length=50)
    occurred_at: datetime | None = None
    properties: dict[str, _Scalar] = Field(default_factory=dict)

    @field_validator("name")
    @classmethod
    def _name_shape(cls, v: str) -> str:
        if not _NAME_RE.match(v):
            raise ValueError("Event names are lower_snake_case, 2 to 49 characters")
        return v

    @field_validator("properties")
    @classmethod
    def _bounded_properties(cls, v: dict[str, _Scalar]) -> dict[str, _Scalar]:
        if len(v) > _MAX_PROPERTIES:
            raise ValueError(f"At most {_MAX_PROPERTIES} properties per event")
        return v


class EventBatch(BaseModel):
    events: list[ClientEvent] = Field(..., min_length=1, max_length=50)
    app_version: str | None = Field(None, max_length=40)
    platform: str | None = Field(None, max_length=20)


def _clip(name: str, key: str, value: Any) -> Any:
    if not isinstance(value, str):
        return value
    limit = _MAX_STACK if name == "client_error" and key == "stack" else _MAX_STRING
    return value[:limit]


@router.post("/events", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def record_events(request: Request, payload: EventBatch, current_user: User = Depends(get_current_user)):
    now = datetime.now(UTC)
    docs = []
    for event in payload.events:
        occurred = event.occurred_at or now
        if occurred.tzinfo is None:
            occurred = occurred.replace(tzinfo=UTC)
        # A phone with a wrong clock must not write events into the future
        # or the distant past.
        if not now - timedelta(days=7) <= occurred <= now + timedelta(minutes=5):
            occurred = now
        docs.append({
            "user_id": current_user.id,
            "name": event.name,
            "properties": {k[:50]: _clip(event.name, k, v) for k, v in event.properties.items()},
            "occurred_at": occurred,
            "created_at": now,
            "app_version": payload.app_version,
            "platform": payload.platform,
        })
    await db.events.insert_many(docs, ordered=False)
    errors = sum(1 for d in docs if d["name"] == "client_error")
    if errors:
        # The count only - the message and stack stay in the collection,
        # where the admin dashboard reads them.
        logger.warning("Client reported %d error(s), app version %s.", errors, payload.app_version)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
