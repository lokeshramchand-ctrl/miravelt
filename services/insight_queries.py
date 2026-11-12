"""Read models over a user's timeline that screens need and no single
period's stored analytics can answer:

* teach deck      - the uncategorised payees covering most unknown spend (B2)
* people ledger   - sent / received / net per person (B3)
* merchant page   - one payee's full history, cadence and monthly series (D8)

Everything is computed from the user's own rows on read; nothing here is
shared across users.
"""
from collections import defaultdict
from typing import Any

from analytics.recurring import Payment, detect
from core.timezone import local_date
from database.mongo import db
from engines.categorizer import payee_key
from engines.rule_engine import rule_engine
from engines.suggest import suggest_category
from models.schemas import TransactionType

_TIMELINE = {"source_statement_ids.0": {"$exists": True}}


class InsightQueries:
    async def teach_deck(self, user_id: str, statement_id: str | None = None, limit: int = 8) -> dict[str, Any]:
        """The few uncategorised payees that explain most of what Miravelt
        could not label: "these 8 names are 61% of what we could not label"."""
        match: dict[str, Any] = {
            "user_id": user_id,
            **_TIMELINE,
            "transaction_type": TransactionType.DEBIT.value,
            "category": {"$in": ["Uncategorized", "Unknown", None]},
        }
        if statement_id:
            match["source_statement_ids"] = statement_id
        pipeline = [
            {"$match": match},
            {"$group": {
                "_id": "$merchant",
                "total": {"$sum": "$amount"},
                "count": {"$sum": 1},
                "payees": {"$addToSet": "$counterparty_raw"},
                "kind": {"$first": "$counterparty_kind"},
                "last": {"$max": "$timestamp"},
                "example_id": {"$first": "$_id"},
            }},
            {"$sort": {"total": -1}},
        ]
        rows = [doc async for doc in db.transactions.aggregate(pipeline)]
        unknown_total = sum(r["total"] for r in rows)
        cards = rows[:limit]
        covered = sum(r["total"] for r in cards)
        labelled = await self._labelled_payees(user_id) if cards else []
        suggestions = {r["_id"]: suggest_category(r["_id"] or "", labelled) for r in cards}
        return {
            "unknown_total": round(unknown_total, 2),
            "unknown_payees": len(rows),
            "covered_total": round(covered, 2),
            "covered_share": round(covered / unknown_total, 4) if unknown_total else 0.0,
            "cards": [
                {
                    "merchant": r["_id"],
                    "total_amount": round(r["total"], 2),
                    "count": r["count"],
                    "payee_names": sorted(p for p in r["payees"] if p),
                    "counterparty_kind": r.get("kind"),
                    "last_paid_at": r["last"],
                    "example_transaction_id": str(r["example_id"]),
                    "share_of_unknown": round(r["total"] / unknown_total, 4) if unknown_total else 0.0,
                    # "Looks like Food - 3 similar names" (B4). A hint only: nothing
                    # is categorised until the user answers the card.
                    "suggested_category": suggestions[r["_id"]].category if suggestions[r["_id"]] else None,
                    "similar_names": suggestions[r["_id"]].similar_names if suggestions[r["_id"]] else [],
                }
                for r in cards
            ],
        }

    @staticmethod
    async def _labelled_payees(user_id: str) -> list[tuple[str, str]]:
        """Names with a known category: this user's own categorised payees
        first, then the curated merchants. Never another user's payees."""
        pipeline = [
            {"$match": {
                "user_id": user_id, **_TIMELINE, "transaction_type": TransactionType.DEBIT.value,
                "category": {"$nin": ["Uncategorized", "Unknown", None]},
            }},
            {"$group": {"_id": "$counterparty_raw", "category": {"$last": "$category"}}},
        ]
        own = [(doc["_id"], doc["category"]) async for doc in db.transactions.aggregate(pipeline) if doc["_id"]]
        curated = [(alias, data["category"]) for alias, data in rule_engine.rules.items()]
        return own + curated

    async def people(self, user_id: str) -> list[dict[str, Any]]:
        """One row per person you exchanged money with, most active first.
        `net` > 0 means they paid you more than you paid them."""
        pipeline = [
            {"$match": {"user_id": user_id, **_TIMELINE, "counterparty_kind": "person"}},
            {"$group": {
                "_id": "$counterparty_raw",
                "sent": {"$sum": {"$cond": [{"$eq": ["$transaction_type", "DEBIT"]}, "$amount", 0]}},
                "received": {"$sum": {"$cond": [{"$eq": ["$transaction_type", "CREDIT"]}, "$amount", 0]}},
                "count": {"$sum": 1},
                "first": {"$min": "$timestamp"},
                "last": {"$max": "$timestamp"},
            }},
            {"$sort": {"last": -1}},
        ]
        merged: dict[str, dict[str, Any]] = {}
        async for doc in db.transactions.aggregate(pipeline):
            key = payee_key(doc["_id"])
            row = merged.setdefault(key, {
                "payee_key": key, "name": doc["_id"], "sent": 0.0, "received": 0.0,
                "count": 0, "first_at": doc["first"], "last_at": doc["last"],
            })
            row["sent"] += doc["sent"]
            row["received"] += doc["received"]
            row["count"] += doc["count"]
            row["first_at"] = min(row["first_at"], doc["first"])
            row["last_at"] = max(row["last_at"], doc["last"])
        out = []
        for row in merged.values():
            row["sent"] = round(row["sent"], 2)
            row["received"] = round(row["received"], 2)
            row["net"] = round(row["received"] - row["sent"], 2)
            out.append(row)
        out.sort(key=lambda r: (r["sent"] + r["received"]), reverse=True)
        return out

    async def payee_transactions(self, user_id: str, key: str, limit: int = 200) -> list[dict[str, Any]]:
        names = [
            n for n in await db.transactions.distinct("counterparty_raw", {"user_id": user_id, **_TIMELINE})
            if n and payee_key(n) == key
        ]
        if not names:
            return []
        cursor = db.transactions.find(
            {"user_id": user_id, **_TIMELINE, "counterparty_raw": {"$in": names}}
        ).sort("timestamp", -1).limit(limit)
        return [doc async for doc in cursor]

    async def merchant_page(self, user_id: str, merchant: str) -> dict[str, Any] | None:
        rows = [
            doc async for doc in db.transactions.find(
                {"user_id": user_id, **_TIMELINE, "merchant": merchant}
            ).sort("timestamp", 1)
        ]
        if not rows:
            return None
        debits = [r for r in rows if r["transaction_type"] == TransactionType.DEBIT.value]
        credits = [r for r in rows if r["transaction_type"] == TransactionType.CREDIT.value]
        monthly: dict[str, float] = defaultdict(float)
        for r in debits:
            d = local_date(r["timestamp"])
            monthly[f"{d.year:04d}-{d.month:02d}"] += r["amount"]
        pattern = detect([Payment(r["timestamp"], r["amount"]) for r in debits])
        total = sum(r["amount"] for r in debits)
        memory = await db.user_merchant_memory.find_one(
            {"user_id": user_id, "merchant": merchant}, {"_id": 0, "memory_state": 1, "category_source": 1}
        )
        return {
            "merchant": merchant,
            "category": debits[-1]["category"] if debits else (rows[-1].get("category")),
            "counterparty_kind": rows[-1].get("counterparty_kind"),
            "payee_names": sorted({r.get("counterparty_raw") for r in rows if r.get("counterparty_raw")}),
            "total_spent": round(total, 2),
            "total_received": round(sum(r["amount"] for r in credits), 2),
            "payment_count": len(debits),
            "average_payment": round(total / len(debits), 2) if debits else 0.0,
            "first_at": rows[0]["timestamp"],
            "last_at": rows[-1]["timestamp"],
            "monthly": [{"month": k, "total_amount": round(v, 2)} for k, v in sorted(monthly.items())],
            "cadence": pattern.cadence if pattern else None,
            "typical_amount": pattern.typical_amount if pattern else None,
            "next_expected_at": pattern.next_expected_at if pattern else None,
            "memory_state": (memory or {}).get("memory_state"),
            "category_source": (memory or {}).get("category_source"),
        }


insight_queries = InsightQueries()
