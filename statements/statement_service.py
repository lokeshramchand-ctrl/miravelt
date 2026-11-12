import asyncio
import logging
import time
from collections import defaultdict

from behaviour.behavior_engine import behavior_engine
from database.mongo import db
from engines.categorizer import CategorizationContext, categorize, payee_key
from engines.counterparty import PERSON
from models.schemas import Statement, Transaction, TransactionCategory, TransactionType
from repositories.job_repository import job_repo
from repositories.memory_repository import memory_repo
from repositories.statement_repository import statement_repo
from repositories.transaction_repository import transaction_repo
from statements.pdf_parser import ParsedTransaction, statement_parser
from statements.recompute import analyse, recompute_statements

logger = logging.getLogger(__name__)

_RECONCILIATION_EPSILON = 0.01

NO_TRANSACTIONS_MESSAGE = (
    "We could not read any transactions from this statement. "
    "If it does have payments in it, please send it to us so we can support its layout."
)


class StatementService:
    """Owns the statement processing pipeline, run by a Celery worker
    (tasks/statement_tasks.py) after POST /statements/upload has returned
    202. PDF validation already happened in the upload handler, so the
    failure modes here are internal errors and a statement with no readable
    transactions. A failure is written onto the Job/Statement documents
    (full detail logged, a generic message persisted) - that is what the
    polling contract (GET /jobs/{id}) reports.

    Stages: parse -> categorize (with this user's memory) -> merge into the
    user's timeline -> remember payees -> profile merchants (this user only)
    -> analytics + insights (statements/recompute.py) -> recompute periods
    this one overlaps or now precedes.
    """

    async def process_statement(self, statement_id: str, job_id: str, full_text: str | None = None) -> None:
        start_time = time.monotonic()
        try:
            # get_by_id and the job claim are inside this try too - a job
            # that fails before ever reaching RUNNING would otherwise stay
            # QUEUED forever, which the stale-job sweep (RUNNING only) never catches.
            statement = await statement_repo.get_by_id(statement_id)
            if statement is None:
                logger.error("Statement %s vanished before processing could start.", statement_id)
                return

            claimed = await job_repo.claim_and_mark_running(job_id, "parsing")
            if not claimed:
                # A redelivered Celery task (acks_late) whose job is already
                # RUNNING or finished - left for the stale-job sweep.
                logger.info("Job %s already claimed or finished - skipping duplicate delivery.", job_id)
                return

            await statement_repo.mark_processing(statement_id)

            if full_text is None:
                # The upload handler parks the text in Mongo and enqueues ids
                # only, so the statement never sits in the broker (F15d).
                doc = await db.statement_texts.find_one({"statement_id": statement_id})
                if doc is None:
                    raise RuntimeError("Statement text is missing - it may have expired before processing.")
                full_text = doc["text"]

            # Synchronous parsing runs on a worker thread so the event loop stays free.
            parsed_records, record_lines = await asyncio.to_thread(self._parse, full_text)
            if not parsed_records:
                await statement_repo.mark_failed(statement_id, NO_TRANSACTIONS_MESSAGE)
                await job_repo.mark_failed(job_id, NO_TRANSACTIONS_MESSAGE)
                return

            await job_repo.update_progress(job_id, "categorizing", 20)
            context = await memory_repo.load_context(statement.user_id)
            kind_overrides = await memory_repo.kind_overrides(statement.user_id)
            known_people = await self._known_people(statement.user_id)
            transactions = await asyncio.to_thread(
                self._build_transactions, statement.user_id, statement_id, parsed_records,
                context, kind_overrides, known_people,
            )

            await job_repo.update_progress(job_id, "persisting_transactions", 40)
            merge = await transaction_repo.bulk_upsert(transactions, statement_id)
            await memory_repo.record_sightings(statement.user_id, self._sightings(transactions, context))

            await job_repo.update_progress(job_id, "profiling_merchants", 55)
            merchants = await transaction_repo.get_distinct_debit_merchants(statement_id)
            await behavior_engine.profile_user(statement.user_id, merchants)

            await job_repo.update_progress(job_id, "generating_insights", 75)
            analytics, insights = await analyse(statement.user_id, statement, use_llm=True)

            computed_sent = round(
                sum(t.amount for t in transactions if t.transaction_type == TransactionType.DEBIT), 2
            )
            computed_received = round(
                sum(t.amount for t in transactions if t.transaction_type == TransactionType.CREDIT), 2
            )
            reconciliation_ok = self._check_reconciliation(statement, computed_sent, computed_received)

            duration_ms = int((time.monotonic() - start_time) * 1000)
            await statement_repo.mark_completed(
                statement_id,
                transaction_count=len(transactions),
                computed_sent_amount=computed_sent,
                computed_received_amount=computed_received,
                reconciliation_ok=reconciliation_ok,
                analytics=analytics,
                insights=insights,
                processing_duration_ms=duration_ms,
                record_line_count=record_lines,
                unparsed_count=max(record_lines - len(parsed_records), 0),
            )
            await job_repo.mark_completed(job_id)
            await db.statement_texts.delete_one({"statement_id": statement_id})

            # Periods this upload overlapped share rows with it; a merge may
            # have refreshed their categories, and a later period's
            # comparison baseline may now be this one.
            if merge["merged"]:
                overlapping = await transaction_repo.statement_ids_sharing(statement.user_id, statement_id)
                await recompute_statements(statement.user_id, [s for s in overlapping if s != statement_id])
            later = await self._later_periods(statement)
            await recompute_statements(statement.user_id, later)

            logger.info(
                "Statement %s processed: %d transactions (%d new, %d already on the timeline), %d unparsed.",
                statement_id, len(transactions), merge["inserted"], merge["merged"],
                max(record_lines - len(parsed_records), 0),
            )
            await _notify_ready(statement.user_id, statement_id, analytics.transaction_count)

        except Exception:
            logger.exception("Statement processing failed for statement %s", statement_id)
            generic_message = "Statement processing failed due to an internal error."
            await statement_repo.mark_failed(statement_id, generic_message)
            await job_repo.mark_failed(job_id, generic_message)

    @staticmethod
    def _parse(full_text: str) -> tuple[list[ParsedTransaction], int]:
        return statement_parser.parse_transactions(full_text), statement_parser.count_record_lines(full_text)

    @staticmethod
    async def _known_people(user_id: str) -> set[str]:
        return {
            doc["payee_key"]
            async for doc in db.user_merchant_memory.find(
                {"user_id": user_id, "counterparty_kind": PERSON}, {"payee_key": 1}
            )
        }

    @staticmethod
    async def _later_periods(statement: Statement) -> list[str]:
        later = await statement_repo.list_completed_for_user(statement.user_id)
        return [s.id for s in later if s.period_start > statement.period_start and s.id != statement.id]

    def _build_transactions(
        self,
        user_id: str,
        statement_id: str,
        parsed_records: list[ParsedTransaction],
        context: CategorizationContext | None = None,
        kind_overrides: dict[str, str] | None = None,
        known_people: set[str] | None = None,
    ) -> list[Transaction]:
        context = context or CategorizationContext()
        kind_overrides = kind_overrides or {}
        known_people = known_people or set()

        # Money flowing both ways with the same name is a person, not a shop
        # (B3): you pay a friend and the friend pays you back.
        directions: dict[str, set[str]] = defaultdict(set)
        for record in parsed_records:
            directions[payee_key(record.counterparty_raw)].add(record.direction)
        two_way = {k for k, d in directions.items() if len(d) == 2}

        transactions = []
        for record in parsed_records:
            key = payee_key(record.counterparty_raw)
            result = categorize(record.counterparty_raw, context)
            kind = kind_overrides.get(key) or (
                PERSON if key in two_way or key in known_people else result.counterparty_kind
            )
            if record.direction == "Paid to":
                merchant, category = result.merchant, result.category
                confidence, source = result.confidence, result.source
                transaction_type = TransactionType.DEBIT
            else:
                # "Received from X" - a person or a source like "Google Pay
                # rewards", not a spending category.
                merchant = record.counterparty_raw
                category = TransactionCategory.INCOME.value
                confidence, source = None, "income"
                transaction_type = TransactionType.CREDIT

            transactions.append(
                Transaction(
                    raw_text=f"{record.direction} {record.counterparty_raw}",
                    merchant=merchant,
                    amount=record.amount,
                    category=category,
                    user_id=user_id,
                    timestamp=record.timestamp,
                    statement_id=statement_id,
                    source_statement_ids=[statement_id],
                    transaction_type=transaction_type,
                    counterparty_raw=record.counterparty_raw,
                    reference_number=record.reference_number,
                    bank=record.bank,
                    account_last4=record.account_last4,
                    categorization_confidence=confidence,
                    categorization_source=source,
                    counterparty_kind=kind,
                )
            )
        return transactions

    @staticmethod
    def _sightings(transactions: list[Transaction], context: CategorizationContext) -> list[dict]:
        grouped: dict[str, dict] = {}
        for t in transactions:
            key = payee_key(t.counterparty_raw)
            if not key:
                continue
            entry = grouped.setdefault(key, {
                "payee_key": key,
                "display_name": t.counterparty_raw,
                "merchant": t.merchant,
                "counterparty_kind": t.counterparty_kind,
                "count": 0,
                "applied_memory": key in context.user_memory and t.transaction_type == TransactionType.DEBIT,
                "first_seen": t.timestamp,
                "last_seen": t.timestamp,
            })
            entry["count"] += 1
            entry["first_seen"] = min(entry["first_seen"], t.timestamp)
            entry["last_seen"] = max(entry["last_seen"], t.timestamp)
            if t.transaction_type == TransactionType.DEBIT:
                entry["merchant"] = t.merchant
        return list(grouped.values())

    @staticmethod
    def _check_reconciliation(statement: Statement, computed_sent: float, computed_received: float) -> bool | None:
        if statement.declared_sent_amount is None or statement.declared_received_amount is None:
            return None
        return (
            abs(computed_sent - statement.declared_sent_amount) < _RECONCILIATION_EPSILON
            and abs(computed_received - statement.declared_received_amount) < _RECONCILIATION_EPSILON
        )


async def _notify_ready(user_id: str, statement_id: str, transaction_count: int) -> None:
    """Server-driven "your period is ready" push (D1). Never fails the job."""
    try:
        from services.push import push_service
        await push_service.send_to_user(
            user_id,
            title="Your period is ready",
            body=f"{transaction_count} transactions analysed. Tap to see where it went.",
            data={"type": "statement_ready", "statement_id": statement_id},
        )
    except Exception:
        logger.warning("Ready push failed for statement %s - continuing.", statement_id, exc_info=True)


statement_service = StatementService()
