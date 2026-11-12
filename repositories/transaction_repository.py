import logging
import re
from datetime import datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import UpdateOne

from database.mongo import db
from models.schemas import Transaction, TransactionType

logger = logging.getLogger(__name__)

_SORTABLE_FIELDS = {"timestamp", "amount", "merchant", "category"}

# Fields a statement parse is authoritative for: the same UPI reference
# always prints the same values, so a later upload may (re)write them.
_PARSED_FIELDS = (
    "raw_text", "amount", "timestamp", "transaction_type", "status", "counterparty_raw",
    "reference_number", "bank", "account_last4", "payment_method", "user_id", "is_mock",
)
# Fields the categorizer decides. A later upload refreshes them - the alias
# list or this user's memory may have improved since - unless the user set
# the category by hand, which nothing automatic may overwrite (F2).
_CATEGORY_FIELDS = ("merchant", "category", "categorization_confidence", "categorization_source")

_IS_USER_SET = {"$eq": ["$categorization_source", "user"]}


def _lit(value: Any) -> Any:
    # Pipeline updates read any string starting with "$" as a field path,
    # and payee names are third-party text.
    return {"$literal": value}


class TransactionRepository:
    async def bulk_upsert(self, transactions: list[Transaction], statement_id: str) -> dict[str, int]:
        """Merges a statement's transactions into the user's timeline
        (PROJECT_AUDIT.md A1). Keyed on (user_id, reference_number) - the
        unique partial index in database/mongo.py.

        A transaction already on the timeline (an overlapping or repeated
        upload) gains `statement_id` as one more source instead of being
        moved to it, so the earlier statement keeps every row it vouched for.
        A user's correction survives the merge.

        Returns {"inserted": n, "merged": m}."""
        if not transactions:
            return {"inserted": 0, "merged": 0}

        operations = []
        for txn in transactions:
            doc = txn.model_dump(by_alias=True, exclude={"id"})
            stage: dict[str, Any] = {f: _lit(doc[f]) for f in _PARSED_FIELDS}
            for f in _CATEGORY_FIELDS:
                stage[f] = {"$cond": [_IS_USER_SET, f"${f}", _lit(doc[f])]}
            stage["counterparty_kind"] = {"$ifNull": ["$counterparty_kind_override", _lit(doc["counterparty_kind"])]}
            stage["statement_id"] = {"$ifNull": ["$statement_id", _lit(statement_id)]}
            stage["source_statement_ids"] = {
                "$setUnion": [{"$ifNull": ["$source_statement_ids", []]}, _lit([statement_id])]
            }
            stage["note"] = {"$ifNull": ["$note", None]}
            stage["tags"] = {"$ifNull": ["$tags", _lit([])]}
            operations.append(
                UpdateOne(
                    {"user_id": txn.user_id, "reference_number": txn.reference_number},
                    [{"$set": stage}],
                    upsert=True,
                )
            )
        result = await db.transactions.bulk_write(operations, ordered=False)
        inserted = result.upserted_count
        return {"inserted": inserted, "merged": len(transactions) - inserted}

    async def get_distinct_debit_merchants(self, statement_id: str) -> list[str]:
        """Merchants touched by this statement's expense transactions.
        Excludes "Unknown" since there's nothing meaningful to profile there."""
        merchants = await db.transactions.distinct(
            "merchant",
            {"source_statement_ids": statement_id, "transaction_type": TransactionType.DEBIT.value},
        )
        return [m for m in merchants if m and m != "Unknown"]

    @staticmethod
    def _search_clause(q: str) -> dict[str, Any]:
        """Free-text search the app's box promises (F14/D7): merchant, the
        printed payee name, the UPI reference, or an exact amount."""
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        clauses: list[dict[str, Any]] = [
            {"merchant": pattern},
            {"counterparty_raw": pattern},
            {"reference_number": pattern},
            {"note": pattern},
            {"tags": pattern},
        ]
        amount_text = q.strip().replace(",", "").lstrip("₹").strip()
        try:
            clauses.append({"amount": float(amount_text)})
        except ValueError:
            pass
        return {"$or": clauses}

    async def list_for_user(
        self,
        user_id: str,
        page: int,
        page_size: int,
        statement_id: str | None = None,
        category: str | None = None,
        transaction_type: TransactionType | None = None,
        merchant: str | None = None,
        q: str | None = None,
        start: datetime | None = None,
        end_exclusive: datetime | None = None,
        sort_by: str = "timestamp",
        sort_order: int = -1,
    ) -> tuple[list[Transaction], int]:
        """The user's statement-derived timeline, optionally narrowed to the
        rows one statement vouches for. Rows written by POST /v1/categorize
        (no reference number, amount 0) are not part of the timeline."""
        query: dict[str, Any] = {"user_id": user_id, "source_statement_ids.0": {"$exists": True}}
        if statement_id:
            query["source_statement_ids"] = statement_id
        if category:
            query["category"] = category
        if transaction_type is not None:
            query["transaction_type"] = transaction_type.value
        if merchant:
            query["merchant"] = {"$regex": re.escape(merchant), "$options": "i"}
        if q and q.strip():
            query.update(self._search_clause(q))
        if start or end_exclusive:
            ts_filter: dict[str, datetime] = {}
            if start:
                ts_filter["$gte"] = start
            if end_exclusive:
                ts_filter["$lt"] = end_exclusive
            query["timestamp"] = ts_filter

        sort_field = sort_by if sort_by in _SORTABLE_FIELDS else "timestamp"
        # Secondary sort on _id keeps paging stable when many rows share an amount or a time.
        total = await db.transactions.count_documents(query)
        cursor = (
            db.transactions.find(query)
            .sort([(sort_field, sort_order), ("_id", sort_order)])
            .skip((page - 1) * page_size)
            .limit(page_size)
        )
        items = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            items.append(Transaction(**doc))
        return items, total

    async def list_for_statement(self, statement_id: str, user_id: str, page: int, page_size: int, **filters):
        return await self.list_for_user(user_id, page, page_size, statement_id=statement_id, **filters)

    async def get_by_id(self, transaction_id: str, user_id: str) -> Transaction | None:
        """Returns None for both "doesn't exist" and "belongs to someone else"."""
        try:
            oid = ObjectId(transaction_id)
        except (InvalidId, TypeError):
            return None
        doc = await db.transactions.find_one({"_id": oid, "user_id": user_id})
        if doc is None:
            return None
        doc["_id"] = str(doc["_id"])
        return Transaction(**doc)

    async def delete_for_statement(self, statement_id: str, user_id: str) -> int:
        """Removes this statement as a source, then deletes only the rows no
        other statement still vouches for (A1). Returns rows deleted."""
        await db.transactions.update_many(
            {"user_id": user_id, "source_statement_ids": statement_id},
            {"$pull": {"source_statement_ids": statement_id}},
        )
        result = await db.transactions.delete_many(
            {"user_id": user_id, "source_statement_ids": {"$size": 0}, "reference_number": {"$exists": True}}
        )
        # A surviving row whose first source was this statement now points at another one.
        async for doc in db.transactions.find(
            {"user_id": user_id, "statement_id": statement_id}, {"source_statement_ids": 1}
        ):
            await db.transactions.update_one(
                {"_id": doc["_id"]}, {"$set": {"statement_id": doc["source_statement_ids"][0]}}
            )
        return result.deleted_count

    async def delete_for_user(self, user_id: str) -> int:
        result = await db.transactions.delete_many({"user_id": user_id})
        return result.deleted_count

    async def update_category(self, transaction_id: str, user_id: str, category: str) -> list[str]:
        """Applies a correction to one transaction. Returns the statements
        whose analytics it touches."""
        try:
            oid = ObjectId(transaction_id)
        except (InvalidId, TypeError):
            return []
        doc = await db.transactions.find_one_and_update(
            {"_id": oid, "user_id": user_id},
            {"$set": {"category": category, "categorization_confidence": 1.0, "categorization_source": "user"}},
            projection={"source_statement_ids": 1},
        )
        return list(doc.get("source_statement_ids") or []) if doc else []

    async def update_category_for_merchant(self, user_id: str, merchant: str, category: str) -> list[str]:
        """Applies a correction to every *payment* this user made to the same
        merchant (correcting one Zomato order recategorises the rest). Money
        received from that name is untouched (F4): a correction to "Ravi"
        must not turn Ravi's repayments into spending. Returns the
        statements whose analytics it touches."""
        match = {"user_id": user_id, "merchant": merchant, "transaction_type": TransactionType.DEBIT.value}
        statement_ids = await db.transactions.distinct("source_statement_ids", match)
        await db.transactions.update_many(
            match,
            {"$set": {"category": category, "categorization_confidence": 1.0, "categorization_source": "user"}},
        )
        return [s for s in statement_ids if s]

    async def distinct_payees_for_merchant(self, user_id: str, merchant: str) -> list[str]:
        return [
            p for p in await db.transactions.distinct(
                "counterparty_raw",
                {"user_id": user_id, "merchant": merchant, "transaction_type": TransactionType.DEBIT.value},
            ) if p
        ]

    async def distinct_payee_names(self, user_id: str) -> list[str]:
        return [n for n in await db.transactions.distinct("counterparty_raw", {"user_id": user_id}) if n]

    async def kind_for_merchant(self, user_id: str, merchant: str) -> str | None:
        doc = await db.transactions.find_one(
            {"user_id": user_id, "merchant": merchant, "counterparty_kind": {"$ne": None}}, {"counterparty_kind": 1}
        )
        return doc.get("counterparty_kind") if doc else None

    async def update_annotations(
        self, transaction_id: str, user_id: str, note: str | None, tags: list[str] | None
    ) -> Transaction | None:
        try:
            oid = ObjectId(transaction_id)
        except (InvalidId, TypeError):
            return None
        update: dict[str, Any] = {}
        if note is not None:
            update["note"] = note.strip() or None
        if tags is not None:
            update["tags"] = sorted({t.strip().lower() for t in tags if t.strip()})
        if update:
            await db.transactions.update_one({"_id": oid, "user_id": user_id}, {"$set": update})
        return await self.get_by_id(transaction_id, user_id)

    async def set_kind_for_payee(self, user_id: str, counterparty_raw_values: list[str], kind: str) -> None:
        await db.transactions.update_many(
            {"user_id": user_id, "counterparty_raw": {"$in": counterparty_raw_values}},
            {"$set": {"counterparty_kind": kind, "counterparty_kind_override": kind}},
        )

    async def statement_ids_for_payees(self, user_id: str, counterparty_raw_values: list[str]) -> list[str]:
        return [
            s for s in await db.transactions.distinct(
                "source_statement_ids", {"user_id": user_id, "counterparty_raw": {"$in": counterparty_raw_values}}
            ) if s
        ]

    async def statement_ids_sharing(self, user_id: str, statement_id: str) -> list[str]:
        """Other statements that vouch for at least one of this statement's rows."""
        ids = await db.transactions.distinct(
            "source_statement_ids", {"user_id": user_id, "source_statement_ids": statement_id}
        )
        return [s for s in ids if s and s != statement_id]

    async def debits_for_user(self, user_id: str, until: datetime | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {
            "user_id": user_id,
            "transaction_type": TransactionType.DEBIT.value,
            "source_statement_ids.0": {"$exists": True},
        }
        if until is not None:
            query["timestamp"] = {"$lt": until}
        projection = {"merchant": 1, "amount": 1, "timestamp": 1, "counterparty_kind": 1, "category": 1}
        return [doc async for doc in db.transactions.find(query, projection).sort("timestamp", 1)]


transaction_repo = TransactionRepository()
