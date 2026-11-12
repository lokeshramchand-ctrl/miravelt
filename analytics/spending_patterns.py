from datetime import datetime
from typing import Any

from database.mongo import db
from models.schemas import TransactionType

# Spending views are about money going out (F8): debits only, never the
# Income category, and only rows that came from a statement (POST
# /v1/categorize writes zero-amount rows that are not part of the timeline).
_SPENDING = {
    "transaction_type": TransactionType.DEBIT.value,
    "category": {"$ne": "Income"},
    "source_statement_ids.0": {"$exists": True},
}


class SpendingPatternsEngine:
    async def get_category_breakdown(self, user_id: str, start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
        """Spending by category for a window."""
        pipeline = [
            {"$match": {"user_id": user_id, **_SPENDING, "timestamp": {"$gte": start_date, "$lt": end_date}}},
            {"$group": {"_id": "$category", "total_amount": {"$sum": "$amount"}, "transaction_count": {"$sum": 1}}},
            {"$sort": {"total_amount": -1}},
        ]
        return [
            {"category": doc["_id"] or "Uncategorized", "total_amount": round(doc["total_amount"], 2),
             "count": doc["transaction_count"]}
            async for doc in db.transactions.aggregate(pipeline)
        ]

    async def get_merchant_frequency(self, user_id: str, limit: int = 5) -> list[dict[str, Any]]:
        """The places this user pays most often (people excluded: a friend is not a merchant)."""
        pipeline = [
            {"$match": {"user_id": user_id, **_SPENDING, "counterparty_kind": {"$ne": "person"}}},
            {"$group": {"_id": "$merchant", "visit_count": {"$sum": 1}, "total_spent": {"$sum": "$amount"}}},
            {"$sort": {"visit_count": -1, "total_spent": -1}},
            {"$limit": limit},
        ]
        return [
            {"merchant": doc["_id"], "visits": doc["visit_count"], "spent": round(doc["total_spent"], 2)}
            async for doc in db.transactions.aggregate(pipeline)
        ]


spending_patterns = SpendingPatternsEngine()
