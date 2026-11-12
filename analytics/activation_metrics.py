import logging

from database.mongo import db

logger = logging.getLogger(__name__)

_ACTIVATION_WINDOW_SECONDS = 24 * 60 * 60


class ActivationMetricsEngine:
    """Computes the four success metrics PRD.md §8 lists: activation rate,
    time to insight, return use, and categorisation quality (share of spend
    with a label, corrections per 100 transactions). All are read off
    fields that already exist (User.created_at, Statement.uploaded_at /
    first_viewed_at, the timeline and the corrections log) - no event
    stream is needed for them. In-app behaviour and crashes are recorded
    separately by routers/events.py.

    Read-only, admin-only (routers/admin.py's GET /admin/overview) - never
    on a user-facing path, so the per-call collection scans below are
    acceptable at this data scale and are not a pattern to reuse elsewhere."""

    async def compute(self) -> dict:
        first_statement_at_by_user: dict[str, object] = {}
        statement_count_by_user: dict[str, int] = {}
        time_to_insight_seconds: list[float] = []

        async for doc in db.statements.find(
            # A generated sample period is a look around, not an activation.
            {"is_sample": {"$ne": True}}, {"user_id": 1, "uploaded_at": 1, "first_viewed_at": 1}
        ).sort(
            "uploaded_at", 1
        ):
            user_id = doc["user_id"]
            statement_count_by_user[user_id] = statement_count_by_user.get(user_id, 0) + 1
            first_statement_at_by_user.setdefault(user_id, doc["uploaded_at"])

            viewed_at = doc.get("first_viewed_at")
            if viewed_at is not None:
                time_to_insight_seconds.append((viewed_at - doc["uploaded_at"]).total_seconds())

        total_users = await db.users.count_documents({})
        activated_within_24h = 0
        async for user in db.users.find({}, {"created_at": 1}):
            first_statement_at = first_statement_at_by_user.get(str(user["_id"]))
            if first_statement_at is None:
                continue
            if (first_statement_at - user["created_at"]).total_seconds() <= _ACTIVATION_WINDOW_SECONDS:
                activated_within_24h += 1

        users_with_a_statement = len(statement_count_by_user)
        returning_users = sum(1 for count in statement_count_by_user.values() if count >= 2)

        # Categorisation quality: how much of what users spent has a label,
        # and how often they had to correct one.
        spend = {"total": 0.0, "labelled": 0.0, "count": 0}
        async for row in db.transactions.aggregate([
            {"$match": {"transaction_type": "DEBIT", "source_statement_ids.0": {"$exists": True}}},
            {"$group": {
                "_id": {"$in": ["$category", ["Uncategorized", "Unknown", None]]},
                "amount": {"$sum": "$amount"},
                "count": {"$sum": 1},
            }},
        ]):
            spend["total"] += row["amount"]
            spend["count"] += row["count"]
            if not row["_id"]:
                spend["labelled"] += row["amount"]
        corrections = await db.feedback.count_documents({})

        time_to_insight_seconds.sort()
        median_seconds_to_insight = (
            time_to_insight_seconds[len(time_to_insight_seconds) // 2] if time_to_insight_seconds else None
        )

        return {
            "activation_rate_24h": round(activated_within_24h / total_users, 4) if total_users else 0.0,
            "median_seconds_to_insight": median_seconds_to_insight,
            "return_use_rate": round(returning_users / users_with_a_statement, 4) if users_with_a_statement else 0.0,
            "categorised_spend_share": round(spend["labelled"] / spend["total"], 4) if spend["total"] else None,
            "corrections_per_100_transactions": (
                round(100 * corrections / spend["count"], 2) if spend["count"] else None
            ),
            "sample_size": {
                "total_users": total_users,
                "users_with_a_statement": users_with_a_statement,
            },
        }


activation_metrics_engine = ActivationMetricsEngine()
