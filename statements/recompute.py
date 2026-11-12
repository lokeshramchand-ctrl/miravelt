"""One home for "work out a period's analytics and insights" - used when a
statement is first processed and again whenever its numbers change: a
correction (PROJECT_AUDIT.md A4/F3), an overlapping upload that merged into
it, or a person/business reclassification.

The first pass may call the model (statements/statement_service.py); a
recompute never does - generated sentences are re-checked against the new
numbers by insights/fact_check.py and kept only if they still hold.
"""
import logging

from analytics.statement_analytics import statement_analytics_engine
from core.timezone import end_of_local_day_exclusive, start_of_local_day
from database.mongo import db
from insights.signals import compute_signals
from insights.statement_insights import statement_insight_generator
from models.schemas import InsightItem, Statement, StatementAnalytics
from repositories.statement_repository import statement_repo

logger = logging.getLogger(__name__)

_ROW_FIELDS = {"merchant": 1, "amount": 1, "timestamp": 1, "transaction_type": 1, "category": 1,
               "counterparty_kind": 1, "_id": 0}


async def _rows(query: dict) -> list[dict]:
    return [doc async for doc in db.transactions.find(query, _ROW_FIELDS)]


def _days(statement: Statement) -> float:
    return float((statement.period_end - statement.period_start).days + 1)


async def signals_for(
    user_id: str, statement: Statement, previous: Statement | None, analytics: StatementAnalytics
) -> list[InsightItem]:
    period = await _rows({"user_id": user_id, "source_statement_ids": statement.id})
    history = await _rows({
        "user_id": user_id,
        "source_statement_ids.0": {"$exists": True},
        "timestamp": {"$lt": end_of_local_day_exclusive(statement.period_end)},
    })
    previous_rows: list[dict] = []
    if previous is not None:
        # The previous period's own days only, so an overlap is not counted twice.
        previous_rows = await _rows({
            "user_id": user_id,
            "source_statement_ids": previous.id,
            "timestamp": {"$lt": start_of_local_day(statement.period_start)},
        })
    return compute_signals(
        period,
        history,
        previous_rows,
        period_days=_days(statement),
        previous_days=_days(previous) if previous else None,
        total_income=analytics.total_income,
        total_spend=analytics.total_spend,
    )


async def analyse(
    user_id: str, statement: Statement, *, use_llm: bool
) -> tuple[StatementAnalytics, list[InsightItem]]:
    analytics = await statement_analytics_engine.compute(user_id, statement)
    previous = await statement_repo.get_previous_completed(user_id, statement)
    previous_analytics = previous.analytics if previous else None
    signals = await signals_for(user_id, statement, previous, analytics)
    if use_llm:
        insights = await statement_insight_generator.generate(analytics, previous_analytics, signals)
    else:
        insights = statement_insight_generator.refresh(statement.insights, analytics, previous_analytics, signals)
    return analytics, insights


async def recompute_statements(user_id: str, statement_ids: list[str]) -> list[str]:
    """Recomputes every completed statement in `statement_ids` (and the
    periods that compare against them). Returns the ids recomputed."""
    if not statement_ids:
        return []
    statements = await statement_repo.list_completed_by_ids(user_id, list(set(statement_ids)))
    done = []
    for statement in sorted(statements, key=lambda s: s.period_start):
        try:
            analytics, insights = await analyse(user_id, statement, use_llm=False)
            await statement_repo.update_analytics(statement.id, analytics, insights)
            done.append(statement.id)
        except Exception:
            logger.warning("Recompute failed for statement %s - continuing.", statement.id, exc_info=True)
    return done
