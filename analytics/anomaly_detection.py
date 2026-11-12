from statistics import median
from typing import Any

from database.mongo import db


class AnomalyDetector:
    async def flag_transaction(self, user_id: str, merchant_name: str, amount: float) -> dict[str, Any]:
        """Is `amount` unusual for *this user* at this merchant? Robust score
        (median and MAD) over the user's own payments - one past splurge does
        not hide the next, and nobody else's habits count (C1)."""
        amounts = [
            doc["amount"] async for doc in db.transactions.find(
                {"user_id": user_id, "merchant": merchant_name, "transaction_type": "DEBIT"}, {"amount": 1}
            )
        ]
        if len(amounts) < 5:
            return {"is_anomaly": False, "reason": "Insufficient baseline data"}
        med = median(amounts)
        mad = median(abs(a - med) for a in amounts) or max(med * 0.05, 1.0)
        score = 0.6745 * (amount - med) / mad
        if abs(score) > 3.5:
            direction = "higher" if amount > med else "lower"
            return {
                "is_anomaly": True,
                "confidence": round(min(0.99, abs(score) / 10.0), 2),
                "reason": f"Amount is much {direction} than your usual {med:,.2f} here.",
            }
        return {"is_anomaly": False, "reason": "Normal spending range"}


anomaly_detector = AnomalyDetector()
