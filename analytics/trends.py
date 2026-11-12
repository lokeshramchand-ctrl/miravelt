from typing import Any

from analytics.spending_patterns import _SPENDING
from core.timezone import local_month_bounds
from database.mongo import db


class TrendAnalyzer:
    async def calculate_mom_growth(self, user_id: str, current_month: int, current_year: int) -> dict[str, Any]:
        """Month-over-month spending, on local (IST) month boundaries (F7),
        counting money out only (F8)."""
        curr_start, next_start = local_month_bounds(current_year, current_month)
        prev_year, prev_month = (current_year - 1, 12) if current_month == 1 else (current_year, current_month - 1)
        prev_start, _ = local_month_bounds(prev_year, prev_month)

        curr_total = await self._sum_spend(user_id, curr_start, next_start)
        prev_total = await self._sum_spend(user_id, prev_start, curr_start)

        growth = 0.0 if prev_total == 0 else (curr_total - prev_total) / prev_total * 100
        trend = "flat" if abs(growth) < 0.5 else ("up" if growth > 0 else "down")
        return {
            "current_spend": round(curr_total, 2),
            "previous_spend": round(prev_total, 2),
            "mom_growth_percentage": round(growth, 2),
            "trend": trend,
        }

    async def _sum_spend(self, user_id: str, start, end) -> float:
        pipeline = [
            {"$match": {"user_id": user_id, **_SPENDING, "timestamp": {"$gte": start, "$lt": end}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]
        res = await db.transactions.aggregate(pipeline).to_list(length=1)
        return res[0]["total"] if res else 0.0


trend_analyzer = TrendAnalyzer()
