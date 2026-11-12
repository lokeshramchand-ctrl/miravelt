"""Grounded context for POST /v1/explain (PROJECT_AUDIT.md F12).

The context is *this user's own* transaction and their own history with
that payee - a direct lookup, not a similarity search over profiles pooled
across accounts. It answers the two things a person asks about a row:
"why is it in this category?" and "is this normal for me?".

Returns None when the user has no such transaction or payee. The router
then short-circuits without calling the model: nothing grounded, nothing
generated (ARCHITECTURE.md's hallucination-prevention invariant).
"""
import logging
import statistics
from typing import Any

from analytics.recurring import Payment, detect
from core.timezone import local_date
from database.mongo import db
from engines.categorizer import payee_key
from engines.rule_engine import rule_engine
from models.schemas import Transaction, TransactionType
from repositories.memory_repository import memory_repo
from repositories.transaction_repository import transaction_repo

logger = logging.getLogger(__name__)

_TIMELINE = {"source_statement_ids.0": {"$exists": True}}
_HISTORY_LIMIT = 500


class ContextRetriever:
    async def for_transaction(self, user_id: str, transaction_id: str) -> dict[str, Any] | None:
        transaction = await transaction_repo.get_by_id(transaction_id, user_id)
        if transaction is None:
            return None
        return await self._build(user_id, transaction)

    async def for_text(self, user_id: str, text: str) -> dict[str, Any] | None:
        """Older clients send the row's text instead of its id. Resolve it
        to one of this user's own payees; an unknown payee has no context."""
        alias = rule_engine.match_alias(text)
        query: dict[str, Any] = {"user_id": user_id, **_TIMELINE}
        if alias is not None:
            query["merchant"] = alias["merchant"]
        else:
            wanted = payee_key(text)
            names = [
                n for n in await transaction_repo.distinct_payee_names(user_id)
                if n and payee_key(n) and payee_key(n) in wanted
            ]
            if not names:
                return None
            # The longest printed name contained in the text is the most specific match.
            query["counterparty_raw"] = max(names, key=len)
        doc = await db.transactions.find_one(query, sort=[("timestamp", -1)])
        if doc is None:
            return None
        doc["_id"] = str(doc["_id"])
        return await self._build(user_id, Transaction(**doc))

    async def _build(self, user_id: str, txn: Transaction) -> dict[str, Any]:
        is_debit = txn.transaction_type != TransactionType.CREDIT
        direction = TransactionType.DEBIT.value if is_debit else TransactionType.CREDIT.value
        same_payee: dict[str, Any] = {"user_id": user_id, **_TIMELINE, "transaction_type": direction}
        if is_debit:
            same_payee["merchant"] = txn.merchant
        else:
            same_payee["counterparty_raw"] = txn.counterparty_raw or txn.merchant
        rows = [
            doc async for doc in db.transactions.find(same_payee, {"amount": 1, "timestamp": 1})
            .sort("timestamp", 1).limit(_HISTORY_LIMIT)
        ]
        amounts = [r["amount"] for r in rows]
        history: dict[str, Any] = {"payments": len(rows)}
        if rows:
            history.update({
                "total": round(sum(amounts), 2),
                "average": round(sum(amounts) / len(amounts), 2),
                "median": round(statistics.median(amounts), 2),
                "smallest": round(min(amounts), 2),
                "largest": round(max(amounts), 2),
                "first_on": local_date(rows[0]["timestamp"]).isoformat(),
                "last_on": local_date(rows[-1]["timestamp"]).isoformat(),
            })

        pattern = detect([Payment(r["timestamp"], r["amount"]) for r in rows]) if is_debit else None
        memory = await memory_repo.get(user_id, payee_key(txn.counterparty_raw or txn.merchant)) or {}

        context: dict[str, Any] = {
            "product": "Miravelt",
            "transaction": {
                "merchant": txn.merchant,
                "payee_name": txn.counterparty_raw,
                "amount": round(txn.amount, 2),
                "paid_on": local_date(txn.timestamp).isoformat(),
                "direction": "paid" if is_debit else "received",
                "category": txn.category,
                "categorized_by": txn.categorization_source or ("income" if not is_debit else "none"),
                "counterparty_kind": txn.counterparty_kind,
            },
            "history": history,
            "pattern": None,
            "memory": {
                "state": memory.get("memory_state"),
                "corrected_by_you": memory.get("category_source") == "user",
                "times_corrected": memory.get("corrections", 0),
            },
        }
        if pattern is not None:
            context["pattern"] = {
                "cadence": pattern.cadence,
                "typical_amount": round(pattern.typical_amount, 2),
                "monthly_equivalent": round(pattern.monthly_equivalent, 2),
                "next_expected_on": local_date(pattern.next_expected_at).isoformat(),
                "amount_change": round(pattern.amount_change, 2) if pattern.amount_change else None,
            }
        if len(rows) >= 3 and history["median"]:
            difference = txn.amount - history["median"]
            context["comparison"] = {
                "difference_from_usual": round(abs(difference), 2),
                "percent_from_usual": round(abs(difference) / history["median"] * 100, 1),
                "direction": "higher" if difference > 0 else "lower" if difference < 0 else "same",
            }
        return context


context_retriever = ContextRetriever()
