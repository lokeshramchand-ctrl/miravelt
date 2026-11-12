from collections import defaultdict
from typing import Any

from analytics.recurring import Payment, detect
from repositories.transaction_repository import transaction_repo


class SubscriptionEngine:
    async def identify_active_subscriptions(self, user_id: str) -> list[dict[str, Any]]:
        """This user's recurring payments over their whole timeline - the same
        model (analytics/recurring.py) the Recurring screen's per-period list
        uses, so the two can no longer disagree (F8)."""
        by_merchant: dict[str, list[Payment]] = defaultdict(list)
        for doc in await transaction_repo.debits_for_user(user_id):
            if doc.get("merchant") and doc["merchant"] != "Unknown":
                by_merchant[doc["merchant"]].append(Payment(doc["timestamp"], float(doc["amount"])))
        subscriptions = []
        for merchant, payments in by_merchant.items():
            pattern = detect(payments)
            if pattern is None:
                continue
            subscriptions.append({
                "merchant": merchant,
                "cadence": pattern.cadence,
                "typical_amount": pattern.typical_amount,
                "estimated_monthly_cost": pattern.monthly_equivalent,
                "periodicity_score": pattern.regularity,
                "occurrences": pattern.occurrences,
                "last_billed": pattern.last_paid_at,
                "next_expected_at": pattern.next_expected_at,
                "amount_change": pattern.amount_change,
            })
        subscriptions.sort(key=lambda s: s["estimated_monthly_cost"], reverse=True)
        return subscriptions


subscription_engine = SubscriptionEngine()
