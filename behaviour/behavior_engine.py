import logging

from database.mongo import db
from features.amount_features import amount_extractor
from features.frequency_features import frequency_extractor
from features.periodicity import periodicity_extractor
from features.temporal_features import temporal_extractor
from models.schemas import BehaviorPattern

logger = logging.getLogger(__name__)


class BehaviorEngine:
    async def profile_merchant_behavior(self, user_id: str, merchant_name: str) -> BehaviorPattern:
        """
        Models one user's behaviour toward one merchant from that user's own
        payments. Never pooled across users (PROJECT_AUDIT.md A2/F5): pooled
        timestamps make a monthly payee look like a daily burst as soon as a
        few users pay it on different days, and a pooled profile of a
        private payee is visible to everyone who pays the same name.
        """
        cursor = db.transactions.find({
            "user_id": user_id,
            "merchant": merchant_name,
            "transaction_type": "DEBIT",
            "source_statement_ids.0": {"$exists": True},
        })
        transactions = [doc async for doc in cursor]

        if not transactions:
            raise ValueError(f"No transaction footprint found for entity: {merchant_name}")

        amounts = [t["amount"] for t in transactions]
        timestamps = [t["timestamp"] for t in transactions]

        # Compute sub-components
        temporal = temporal_extractor.extract_temporal_metrics(timestamps)
        stats = amount_extractor.extract_statistical_metrics(amounts)
        frequency_data = frequency_extractor.extract_frequency_metrics(timestamps)
        periodicity = periodicity_extractor.calculate_periodicity(timestamps)
        # Combine into complete Behavior Pattern schema
        pattern = BehaviorPattern(
            merchant_name=merchant_name,
            user_id=user_id,
            avg_amount=stats["avg_amount"],
            median_amount=stats["median_amount"],
            variance=stats["variance"],
            std_dev=stats["std_dev"],
            entropy_score=stats["entropy_score"],
            preferred_hour=temporal["preferred_hour"],
            time_bucket_distribution=temporal["time_bucket_distribution"],
            weekday_distribution=temporal["weekday_distribution"],
            daily_frequency=frequency_data["daily_frequency"],
            weekly_frequency=frequency_data["weekly_frequency"],
            periodicity_score=periodicity["periodicity_score"]
        )

        # Persist profile or update existing record
        await db.behavior_patterns.update_one(
            {"user_id": user_id, "merchant_name": merchant_name},
            {"$set": pattern.model_dump(by_alias=True, exclude={"id"})},
            upsert=True
        )

        return pattern

    async def profile_user(self, user_id: str, merchant_names: list[str] | None = None) -> int:
        """Profiles every (or the given) merchant this user has paid.
        One merchant's failure does not stop the rest."""
        if merchant_names is None:
            merchant_names = [
                m for m in await db.transactions.distinct(
                    "merchant", {"user_id": user_id, "transaction_type": "DEBIT"}
                ) if m and m != "Unknown"
            ]
        done = 0
        for name in merchant_names:
            try:
                await self.profile_merchant_behavior(user_id, name)
                done += 1
            except Exception:
                logger.warning("Behaviour profiling failed for one merchant - continuing.", exc_info=True)
        return done

behavior_engine = BehaviorEngine()
