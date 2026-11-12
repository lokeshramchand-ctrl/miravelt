from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from analytics.recurring import Payment, detect, months_covered
from core.timezone import APP_TZ_NAME, end_of_local_day_exclusive, start_of_local_day
from database.mongo import db
from models.schemas import (
    CategoryBreakdownItem,
    DailyTrendItem,
    MerchantSpendItem,
    RecurringPaymentItem,
    Statement,
    StatementAnalytics,
    TransactionStatus,
    TransactionType,
)
from repositories.transaction_repository import transaction_repo


class StatementAnalyticsEngine:
    """Analytics for one statement's period, computed over the rows that
    statement vouches for (`source_statement_ids`, PROJECT_AUDIT.md A1).
    Computed during job processing and again whenever a correction touches
    the period (feedback/feedback_service.py), then persisted on the
    Statement; GET /statements/{id}/analytics reads that back.

    Days are local days (core/timezone.py, F7). Recurring payments come from
    this user's own history (analytics/recurring.py, F5/F6)."""

    async def compute(self, user_id: str, statement: Statement) -> StatementAnalytics:
        base_match = {"user_id": user_id, "source_statement_ids": statement.id}
        period_start = start_of_local_day(statement.period_start)
        period_end = end_of_local_day_exclusive(statement.period_end)

        totals = await self._compute_totals(base_match)
        category_breakdown = await self._category_breakdown(base_match)
        top_merchants = await self._top_merchants(base_match)
        daily_trend = await self._daily_trend(base_match)
        failed_count = await db.transactions.count_documents(
            {**base_match, "status": TransactionStatus.FAILED.value}
        )
        average_monthly_spend = round(totals["total_spend"] / months_covered(period_start, period_end), 2)
        recurring_payments = await self._recurring_payments(
            user_id, period_start, period_end, average_monthly_spend
        )

        return StatementAnalytics(
            total_spend=totals["total_spend"],
            total_income=totals["total_income"],
            net=round(totals["total_income"] - totals["total_spend"], 2),
            average_transaction_value=totals["average_transaction_value"],
            transaction_count=totals["transaction_count"],
            failed_transaction_count=failed_count,
            category_breakdown=category_breakdown,
            top_merchants=top_merchants,
            daily_trend=daily_trend,
            recurring_payments=recurring_payments,
            average_monthly_spend=average_monthly_spend,
        )

    async def _compute_totals(self, base_match: dict[str, Any]) -> dict[str, Any]:
        pipeline = [
            {"$match": base_match},
            {
                "$group": {
                    "_id": None,
                    "total_spend": {
                        "$sum": {"$cond": [{"$eq": ["$transaction_type", TransactionType.DEBIT.value]}, "$amount", 0]}
                    },
                    "total_income": {
                        "$sum": {"$cond": [{"$eq": ["$transaction_type", TransactionType.CREDIT.value]}, "$amount", 0]}
                    },
                    "transaction_count": {"$sum": 1},
                    "amount_sum": {"$sum": "$amount"},
                }
            },
        ]
        result = await db.transactions.aggregate(pipeline).to_list(length=1)
        if not result:
            return {"total_spend": 0.0, "total_income": 0.0, "transaction_count": 0, "average_transaction_value": 0.0}

        row = result[0]
        avg = row["amount_sum"] / row["transaction_count"] if row["transaction_count"] else 0.0
        return {
            "total_spend": round(row["total_spend"], 2),
            "total_income": round(row["total_income"], 2),
            "transaction_count": row["transaction_count"],
            "average_transaction_value": round(avg, 2),
        }

    async def _category_breakdown(self, base_match: dict[str, Any]) -> list[CategoryBreakdownItem]:
        pipeline = [
            {"$match": base_match},
            {"$group": {"_id": "$category", "total_amount": {"$sum": "$amount"}, "count": {"$sum": 1}}},
            {"$sort": {"total_amount": -1}},
        ]
        return [
            CategoryBreakdownItem(category=doc["_id"] or "Unknown", total_amount=doc["total_amount"], count=doc["count"])
            async for doc in db.transactions.aggregate(pipeline)
        ]

    async def _top_merchants(self, base_match: dict[str, Any], limit: int = 10) -> list[MerchantSpendItem]:
        # DEBIT only: "top merchants" means "where you spend", not "who sent you money".
        pipeline = [
            {"$match": {**base_match, "transaction_type": TransactionType.DEBIT.value}},
            {"$group": {"_id": "$merchant", "total_amount": {"$sum": "$amount"}, "count": {"$sum": 1}}},
            {"$sort": {"total_amount": -1}},
            {"$limit": limit},
        ]
        return [
            MerchantSpendItem(merchant=doc["_id"] or "Unknown", total_amount=doc["total_amount"], count=doc["count"])
            async for doc in db.transactions.aggregate(pipeline)
        ]

    async def _daily_trend(self, base_match: dict[str, Any]) -> list[DailyTrendItem]:
        pipeline = [
            {"$match": {**base_match, "transaction_type": TransactionType.DEBIT.value}},
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp", "timezone": APP_TZ_NAME}},
                    "total_amount": {"$sum": "$amount"},
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id": 1}},
        ]
        return [
            DailyTrendItem(
                date=datetime.strptime(doc["_id"], "%Y-%m-%d").date(),
                total_amount=doc["total_amount"],
                count=doc["count"],
            )
            async for doc in db.transactions.aggregate(pipeline)
        ]

    async def _recurring_payments(
        self, user_id: str, period_start: datetime, period_end: datetime, average_monthly_spend: float
    ) -> list[RecurringPaymentItem]:
        """Payees this user pays on a schedule, judged on their whole history
        up to the end of this period, listed if they were paid within it."""
        by_merchant: dict[str, list[Payment]] = defaultdict(list)
        for doc in await transaction_repo.debits_for_user(user_id, until=period_end):
            if doc.get("merchant") and doc["merchant"] != "Unknown":
                by_merchant[doc["merchant"]].append(Payment(doc["timestamp"], float(doc["amount"])))

        items: list[RecurringPaymentItem] = []
        for merchant, payments in by_merchant.items():
            if not any(_aware(p.timestamp) >= period_start for p in payments):
                continue
            pattern = detect(payments)
            if pattern is None:
                continue
            items.append(RecurringPaymentItem(
                merchant=merchant,
                estimated_monthly_cost=pattern.monthly_equivalent,
                periodicity_score=pattern.regularity,
                occurrences=pattern.occurrences,
                cadence=pattern.cadence,
                cadence_days=pattern.cadence_days,
                typical_amount=pattern.typical_amount,
                last_amount=pattern.last_amount,
                last_paid_at=pattern.last_paid_at,
                next_expected_at=pattern.next_expected_at,
                amount_change=pattern.amount_change,
                share_of_monthly_spend=(
                    round(pattern.monthly_equivalent / average_monthly_spend, 4) if average_monthly_spend else None
                ),
            ))
        items.sort(key=lambda r: r.estimated_monthly_cost, reverse=True)
        return items


def _aware(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


statement_analytics_engine = StatementAnalyticsEngine()
