"""Per-user merchant memory and community aliases (PROJECT_AUDIT.md B1, B5).

`user_merchant_memory` - one document per (user_id, payee_key):
    display_name, merchant, counterparty_kind,
    category / category_source   set only by the user's own correction
    sightings                    statements' payments to this payee, ever
    confirmations                sightings since the last correction that
                                 the remembered category was applied to
    memory_state                 EPHEMERAL -> TEMPORARY -> PERMANENT, by
                                 memory/state_machine.py's thresholds on
                                 `confirmations` (a correction itself puts a
                                 payee at TEMPORARY at least)
    first_seen / last_seen

This is the per-user replacement for the global `merchant_profiles`
collection, which nothing on the product path ever wrote (F12).

`community_alias_votes` - one document per (payee_key, user_id) holding that
user's latest correction for a *business* payee. A payee becomes a community
alias when COMMUNITY_ALIAS_MIN_USERS distinct users agree on its category.
People are never voted (engines/counterparty.py), so a private name can
never become shared knowledge.
"""
from datetime import UTC, datetime
from typing import Any

from pymongo import UpdateOne

from core.config import settings
from database.mongo import db
from engines.categorizer import CategorizationContext, MemoryEntry
from engines.counterparty import BUSINESS
from memory.state_machine import state_machine
from models.schemas import MemoryState


def _state_for(confirmations: int, corrected: bool) -> str:
    if confirmations >= state_machine.PERMANENT_THRESHOLD:
        return MemoryState.PERMANENT.value
    if corrected or confirmations >= state_machine.TEMPORARY_THRESHOLD:
        return MemoryState.TEMPORARY.value
    return MemoryState.EPHEMERAL.value


class MemoryRepository:
    async def load_context(self, user_id: str) -> CategorizationContext:
        user_memory = {
            doc["payee_key"]: MemoryEntry(category=doc["category"], merchant=doc.get("merchant"))
            async for doc in db.user_merchant_memory.find(
                {"user_id": user_id, "category": {"$ne": None}},
                {"payee_key": 1, "category": 1, "merchant": 1},
            )
        }
        return CategorizationContext(user_memory=user_memory, community=await self.community_aliases())

    async def community_aliases(self) -> dict[str, MemoryEntry]:
        min_users = settings.COMMUNITY_ALIAS_MIN_USERS
        pipeline = [
            {"$group": {
                "_id": {"key": "$payee_key", "category": "$category"},
                "users": {"$sum": 1},
                "merchant": {"$first": "$merchant"},
            }},
            {"$match": {"users": {"$gte": min_users}}},
            {"$sort": {"users": -1}},
        ]
        result: dict[str, MemoryEntry] = {}
        async for doc in db.community_alias_votes.aggregate(pipeline):
            # Highest agreement first, so a contested key keeps its majority category.
            result.setdefault(doc["_id"]["key"], MemoryEntry(category=doc["_id"]["category"], merchant=doc["merchant"]))
        return result

    async def record_sightings(self, user_id: str, sightings: list[dict[str, Any]]) -> None:
        """One entry per payee in a processed statement: payee_key,
        display_name, merchant, counterparty_kind, count, applied_memory
        (whether the remembered category was used), first_seen, last_seen."""
        if not sightings:
            return
        now = datetime.now(UTC)
        ops = [
            UpdateOne(
                {"user_id": user_id, "payee_key": s["payee_key"]},
                {
                    "$setOnInsert": {
                        "user_id": user_id,
                        "payee_key": s["payee_key"],
                        "category": None,
                        "category_source": None,
                        "created_at": now,
                    },
                    "$set": {
                        "display_name": s["display_name"],
                        "merchant": s["merchant"],
                        "counterparty_kind": s["counterparty_kind"],
                        "updated_at": now,
                    },
                    "$inc": {
                        "sightings": s["count"],
                        "confirmations": s["count"] if s.get("applied_memory") else 0,
                    },
                    "$min": {"first_seen": s["first_seen"]},
                    "$max": {"last_seen": s["last_seen"]},
                },
                upsert=True,
            )
            for s in sightings
        ]
        await db.user_merchant_memory.bulk_write(ops, ordered=False)
        await self._refresh_states(user_id, [s["payee_key"] for s in sightings])

    async def remember_correction(
        self, user_id: str, payee_key: str, display_name: str, merchant: str | None, category: str,
        counterparty_kind: str | None,
    ) -> None:
        now = datetime.now(UTC)
        await db.user_merchant_memory.update_one(
            {"user_id": user_id, "payee_key": payee_key},
            {
                "$set": {
                    "display_name": display_name,
                    "merchant": merchant,
                    "category": category,
                    "category_source": "user",
                    "confirmations": 0,  # a new answer restarts the count toward PERMANENT
                    "memory_state": MemoryState.TEMPORARY.value,
                    "corrected_at": now,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "user_id": user_id, "payee_key": payee_key, "sightings": 0,
                    "first_seen": now, "last_seen": now, "created_at": now,
                    "counterparty_kind": counterparty_kind,
                },
                "$inc": {"corrections": 1},
            },
            upsert=True,
        )
        if counterparty_kind == BUSINESS and payee_key:
            await db.community_alias_votes.update_one(
                {"payee_key": payee_key, "user_id": user_id},
                {"$set": {"category": category, "merchant": merchant, "updated_at": now}},
                upsert=True,
            )
        else:
            # A payee reclassified as a person must not keep an earlier vote.
            await db.community_alias_votes.delete_one({"payee_key": payee_key, "user_id": user_id})

    async def set_kind(self, user_id: str, payee_key: str, kind: str) -> None:
        await db.user_merchant_memory.update_one(
            {"user_id": user_id, "payee_key": payee_key},
            {"$set": {"counterparty_kind": kind, "kind_source": "user", "updated_at": datetime.now(UTC)}},
        )
        if kind != BUSINESS:
            await db.community_alias_votes.delete_one({"payee_key": payee_key, "user_id": user_id})

    async def get(self, user_id: str, payee_key: str) -> dict[str, Any] | None:
        return await db.user_merchant_memory.find_one({"user_id": user_id, "payee_key": payee_key}, {"_id": 0})

    async def kind_overrides(self, user_id: str) -> dict[str, str]:
        return {
            doc["payee_key"]: doc["counterparty_kind"]
            async for doc in db.user_merchant_memory.find(
                {"user_id": user_id, "kind_source": "user"}, {"payee_key": 1, "counterparty_kind": 1}
            )
        }

    async def delete_for_user(self, user_id: str) -> None:
        await db.user_merchant_memory.delete_many({"user_id": user_id})
        await db.community_alias_votes.delete_many({"user_id": user_id})

    async def _refresh_states(self, user_id: str, payee_keys: list[str]) -> None:
        ops = []
        async for doc in db.user_merchant_memory.find(
            {"user_id": user_id, "payee_key": {"$in": payee_keys}},
            {"payee_key": 1, "confirmations": 1, "category": 1, "memory_state": 1},
        ):
            state = _state_for(doc.get("confirmations", 0), doc.get("category") is not None)
            if state != doc.get("memory_state"):
                ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": {"memory_state": state}}))
        if ops:
            await db.user_merchant_memory.bulk_write(ops, ordered=False)


memory_repo = MemoryRepository()
