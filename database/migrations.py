"""Idempotent data migrations, run at startup before index creation.

Each step is safe to run on every boot: it only touches documents still in
the old shape. Failures are logged and skipped, like ensure_indexes - an app
that starts with a half-migrated collection is better than one that does not
start - but every step is written so the next boot finishes the job.
"""
import logging

from pymongo.errors import OperationFailure

from database.mongo import db

logger = logging.getLogger(__name__)


async def _backfill_transaction_sources() -> None:
    """A1: rows written before the timeline model have `statement_id` only."""
    result = await db.transactions.update_many(
        {"statement_id": {"$ne": None}, "source_statement_ids": {"$exists": False}},
        [{"$set": {"source_statement_ids": ["$statement_id"]}}],
    )
    if result.modified_count:
        logger.info("Migration: backfilled source_statement_ids on %d transactions.", result.modified_count)


async def _mark_user_corrections() -> None:
    """F2: before `categorization_source`, a correction was confidence 1.0."""
    result = await db.transactions.update_many(
        {"categorization_confidence": 1.0, "categorization_source": {"$exists": False}},
        {"$set": {"categorization_source": "user"}},
    )
    if result.modified_count:
        logger.info("Migration: marked %d corrected transactions as user-set.", result.modified_count)


async def _per_user_behavior_patterns() -> None:
    """A2/F5: profiles pooled across users are wrong for everyone and leak
    private payees between accounts. Drop them and the global unique index;
    they are rebuilt per user by the next statement or the behaviour pipeline."""
    try:
        indexes = await db.behavior_patterns.index_information()
    except OperationFailure:
        indexes = {}
    if "merchant_name_1" in indexes:
        await db.behavior_patterns.drop_index("merchant_name_1")
        logger.info("Migration: dropped global behavior_patterns.merchant_name index.")
    result = await db.behavior_patterns.delete_many({"user_id": {"$exists": False}})
    if result.deleted_count:
        logger.info("Migration: deleted %d pooled (cross-user) behaviour profiles.", result.deleted_count)


async def _canonical_uncategorized() -> None:
    """F4: "Unknown" and "Uncategorized" were two names for one thing."""
    result = await db.transactions.update_many({"category": "Unknown"}, {"$set": {"category": "Uncategorized"}})
    if result.modified_count:
        logger.info("Migration: renamed %d 'Unknown' categories to 'Uncategorized'.", result.modified_count)


MIGRATIONS = (
    _backfill_transaction_sources,
    _mark_user_corrections,
    _per_user_behavior_patterns,
    _canonical_uncategorized,
)


async def run_migrations() -> None:
    for step in MIGRATIONS:
        try:
            await step()
        except Exception:
            logger.warning("Migration step %s failed - will retry next start.", step.__name__, exc_info=True)
