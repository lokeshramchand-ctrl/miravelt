import logging
from datetime import UTC, datetime
from typing import Any

from database.mongo import db
from engines.categorizer import payee_key
from models.schemas import Transaction, TransactionCategory
from repositories.memory_repository import memory_repo
from repositories.transaction_repository import transaction_repo
from statements.recompute import recompute_statements

logger = logging.getLogger(__name__)

# The app's picker said "Unknown", the rule engine writes "Uncategorized" (F4).
_ALIASES = {TransactionCategory.UNKNOWN.value: TransactionCategory.UNCATEGORIZED.value}


def normalise_category(category: str) -> str:
    return _ALIASES.get(category, category)


class FeedbackService:
    async def process_feedback(
        self,
        transaction: Transaction,
        original_prediction: str,
        corrected_category: str,
        confidence: float,
        user_id: str,
    ) -> dict[str, Any]:
        """Records a category correction and makes it count:

        1. every payment this user made to the same merchant takes the new
           category (never the money they *received* from that name - F4);
        2. each printed payee name behind that merchant is remembered for
           this user, so the next statement is categorised the same way
           (engines/categorizer.py, B1/F2), and a business payee casts a
           vote toward a shared community alias (B5);
        3. every period those payments belong to has its analytics and
           insights recomputed, so Overview agrees with Activity (A4/F3).
        """
        corrected_category = normalise_category(corrected_category)
        original_prediction = normalise_category(original_prediction)
        is_correction = original_prediction != corrected_category or transaction.category != corrected_category
        merchant_name = transaction.merchant

        feedback_doc = {
            "transaction_id": transaction.id,
            "merchant_name": merchant_name,
            "prediction": original_prediction,
            "corrected_category": corrected_category,
            "confidence": confidence,
            "is_correction": is_correction,
            "user_id": user_id,
            "timestamp": datetime.now(UTC),
        }
        await db.feedback.insert_one(feedback_doc)
        feedback_doc.pop("_id", None)

        recomputed: list[str] = []
        if is_correction:
            if merchant_name:
                affected = await self.apply_merchant_correction(
                    user_id, merchant_name, corrected_category, transaction.counterparty_kind
                )
            else:
                affected = await transaction_repo.update_category(transaction.id, user_id, corrected_category)
                if transaction.counterparty_raw:
                    await memory_repo.remember_correction(
                        user_id, payee_key(transaction.counterparty_raw), transaction.counterparty_raw,
                        None, corrected_category, transaction.counterparty_kind,
                    )
            recomputed = await recompute_statements(user_id, affected)
            await self._log_correction(transaction.id, corrected_category, original_prediction, user_id)

        logger.info("Feedback logged for TX %s. Correction made: %s", transaction.id, is_correction)
        return {**feedback_doc, "recomputed_statement_ids": recomputed}

    async def apply_merchant_correction(
        self, user_id: str, merchant_name: str, category: str, counterparty_kind: str | None
    ) -> list[str]:
        """Recategorises every payment to `merchant_name` and remembers each
        printed payee name behind it. Returns the statements touched - the
        caller recomputes them (once, even for a batch of answers)."""
        category = normalise_category(category)
        if counterparty_kind is None:
            counterparty_kind = await transaction_repo.kind_for_merchant(user_id, merchant_name)
        affected = await transaction_repo.update_category_for_merchant(user_id, merchant_name, category)
        for payee in await transaction_repo.distinct_payees_for_merchant(user_id, merchant_name):
            await memory_repo.remember_correction(
                user_id, payee_key(payee), payee, merchant_name, category, counterparty_kind
            )
        return affected

    async def _log_correction(self, transaction_id: str, verified_category: str, failed_prediction: str, user_id: str):
        """Keeps every correction as a labelled example. These are the
        evaluation set the categoriser is measured against (evaluation/,
        PROJECT_AUDIT.md B6/E2) - not fuel for a retraining job."""
        await db.retraining_queue.insert_one({
            "transaction_id": transaction_id,
            "user_id": user_id,
            "verified_category": verified_category,
            "failed_prediction": failed_prediction,
            "status": "pending",
            "added_at": datetime.now(UTC),
        })


feedback_service = FeedbackService()
