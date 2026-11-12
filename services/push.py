"""Server-driven push notifications through the Expo push service
(PROJECT_AUDIT.md D1/F16).

The "period ready" notification used to be a local notification fired by
the Analysing screen's poll loop - so it only arrived if that screen was
still alive, which is exactly the case where nobody needs it. Now the
Celery worker sends it when the job completes, to every device the user
registered (POST /users/me/push-tokens).

Tokens Expo reports as DeviceNotRegistered are deleted. Sending never
raises: a push is a courtesy on top of a finished job.
"""
import logging
from datetime import UTC, datetime
from typing import Any

import httpx

from core.config import settings
from database.mongo import db

logger = logging.getLogger(__name__)


class PushService:
    async def register(self, user_id: str, token: str, platform: str | None) -> None:
        now = datetime.now(UTC)
        # A token belongs to one install; if another account signs in on the
        # same phone, the token moves to that account.
        await db.push_tokens.update_one(
            {"token": token},
            {"$set": {"user_id": user_id, "platform": platform, "updated_at": now},
             "$setOnInsert": {"created_at": now}},
            upsert=True,
        )

    async def unregister(self, user_id: str, token: str) -> None:
        await db.push_tokens.delete_one({"token": token, "user_id": user_id})

    async def delete_for_user(self, user_id: str) -> None:
        await db.push_tokens.delete_many({"user_id": user_id})

    async def send_to_user(self, user_id: str, *, title: str, body: str, data: dict[str, Any]) -> int:
        if not settings.PUSH_NOTIFICATIONS_ENABLED or not settings.EXPO_PUSH_URL:
            return 0
        tokens = [doc["token"] async for doc in db.push_tokens.find({"user_id": user_id}, {"token": 1})]
        if not tokens:
            return 0
        messages = [
            {"to": t, "title": title, "body": body, "data": data, "sound": "default", "channelId": "job_status"}
            for t in tokens
        ]
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(settings.EXPO_PUSH_URL, json=messages)
                response.raise_for_status()
                tickets = response.json().get("data", [])
        except Exception:
            logger.warning("Expo push send failed.", exc_info=True)
            return 0
        sent = 0
        for token, ticket in zip(tokens, tickets, strict=False):
            if ticket.get("status") == "ok":
                sent += 1
            elif (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                await db.push_tokens.delete_one({"token": token})
        return sent


push_service = PushService()
