from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query

from analytics.anomaly_detection import anomaly_detector
from analytics.spending_patterns import spending_patterns
from analytics.subscriptions import subscription_engine
from analytics.trends import trend_analyzer
from core.cache import cached
from core.jwt_auth import get_current_user
from models.schemas import User

router = APIRouter(prefix="/v1/analytics", tags=["Analytics Engine"])

# Short TTL: these are full-history aggregation queries, expensive enough to
# matter once many users open the app's dashboard concurrently, but a few
# minutes' staleness is an acceptable tradeoff for spend analytics - unlike
# the write path (ingestion, feedback), which is never cached. No explicit
# invalidation on write: coupling every ingestion/feedback write path to
# these cache keys would be a second data-access path for the same
# information (ARCHITECTURE.md §4) for a staleness window this short.
_ANALYTICS_CACHE_TTL_SECONDS = 180


def _mom_cache_key(current_user, **_) -> str:
    now = datetime.now(UTC)
    return f"analytics:mom:{current_user.id}:{now.year}-{now.month:02d}"


@router.get("/patterns/categories")
@cached(
    key_builder=lambda current_user, days=30, **_: f"analytics:categories:{current_user.id}:{days}",
    ttl_seconds=_ANALYTICS_CACHE_TTL_SECONDS,
)
async def get_category_patterns(
    days: int = Query(30, description="Lookback window in days"),
    current_user: User = Depends(get_current_user),
):
    end_date = datetime.now(UTC)
    start_date = end_date - timedelta(days=days)

    return await spending_patterns.get_category_breakdown(current_user.id, start_date, end_date)

@router.get("/patterns/merchants")
@cached(
    key_builder=lambda current_user, limit=5, **_: f"analytics:merchants:{current_user.id}:{limit}",
    ttl_seconds=_ANALYTICS_CACHE_TTL_SECONDS,
)
async def get_top_merchants(limit: int = 5, current_user: User = Depends(get_current_user)):
    return await spending_patterns.get_merchant_frequency(current_user.id, limit)

@router.get("/subscriptions")
@cached(
    key_builder=lambda current_user, **_: f"analytics:subscriptions:{current_user.id}",
    ttl_seconds=_ANALYTICS_CACHE_TTL_SECONDS,
)
async def get_subscriptions(current_user: User = Depends(get_current_user)):
    subs = await subscription_engine.identify_active_subscriptions(current_user.id)
    total_burn = sum(sub["estimated_monthly_cost"] for sub in subs)
    return {
        "active_subscriptions": len(subs),
        "total_monthly_burn": total_burn,
        "details": subs
    }

@router.get("/trends/mom")
@cached(key_builder=_mom_cache_key, ttl_seconds=_ANALYTICS_CACHE_TTL_SECONDS)
async def get_mom_trends(current_user: User = Depends(get_current_user)):
    now = datetime.now(UTC)
    return await trend_analyzer.calculate_mom_growth(current_user.id, now.month, now.year)

@router.post("/anomaly/check")
async def check_anomaly(merchant: str, amount: float):
    """Real-time evaluation for the transaction ingestion pipeline. Not
    user-scoped (a merchant/amount pair is evaluated against that merchant's
    global behavioral profile, not any one user's history) - API-key auth
    only, like /v1/resolve and /v1/confidence/evaluate."""
    return await anomaly_detector.flag_transaction(merchant, amount)
