import asyncio
import hashlib
import logging
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status

from behaviour.behavior_engine import behavior_engine
from core.config import settings
from core.error_handlers import CodedHTTPException
from core.jwt_auth import get_current_user
from core.pagination import PaginationParams, resolve_sort_order, total_pages
from core.pdf_validation import PDFValidationError, validate_pdf_upload
from core.rate_limiter import limiter
from core.timezone import end_of_local_day_exclusive, local_date, start_of_local_day
from database.mongo import db
from models.schemas import (
    Job,
    JobType,
    Statement,
    StatementAnalyticsResponse,
    StatementInsightsResponse,
    StatementListResponse,
    StatementResponse,
    StatementStatus,
    StatementUploadResponse,
    TransactionListResponse,
    TransactionResponse,
    TransactionType,
    User,
)
from repositories.job_repository import job_repo
from repositories.statement_repository import statement_repo
from repositories.transaction_repository import transaction_repo
from statements.pdf_parser import (
    CorruptedPDFError,
    IncorrectPasswordError,
    PasswordRequiredError,
    UnsupportedStatementError,
    statement_parser,
)
from statements.recompute import recompute_statements
from statements.synthetic import SyntheticStatement
from tasks import statement_tasks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/statements", tags=["Statements"])


async def _get_owned_statement(statement_id: str, current_user: User) -> Statement:
    """404s if the statement doesn't exist *or* belongs to someone else -
    deliberately not 403, so a caller can't tell the difference between "not
    yours" and "doesn't exist" (same posture already used for /memory/*)."""
    statement = await statement_repo.get_by_id(statement_id)
    if statement is None or statement.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statement not found")
    return statement


def _to_statement_response(statement: Statement) -> StatementResponse:
    return StatementResponse(
        id=statement.id,
        original_filename=statement.original_filename,
        file_size_bytes=statement.file_size_bytes,
        page_count=statement.page_count,
        period_start=statement.period_start,
        period_end=statement.period_end,
        declared_sent_amount=statement.declared_sent_amount,
        declared_received_amount=statement.declared_received_amount,
        computed_sent_amount=statement.computed_sent_amount,
        computed_received_amount=statement.computed_received_amount,
        reconciliation_ok=statement.reconciliation_ok,
        unparsed_count=statement.unparsed_count,
        analytics_revision=statement.analytics_revision,
        is_sample=statement.is_sample,
        transaction_count=statement.transaction_count,
        processing_status=statement.processing_status,
        current_job_id=statement.current_job_id,
        error_message=statement.error_message,
        analytics_version=statement.analytics_version,
        uploaded_at=statement.uploaded_at,
        processing_completed_at=statement.processing_completed_at,
        processing_duration_ms=statement.processing_duration_ms,
    )


def _inspect_statement_pdf(raw_bytes: bytes, password: str | None):
    """Every synchronous PDF step the upload has to finish before it can
    answer 202, bundled so it runs as one worker-thread call."""
    page_count, pdf_metadata = statement_parser.open_and_inspect(raw_bytes, password)
    full_text = statement_parser.extract_text(raw_bytes, password)
    statement_parser.validate_signature(full_text)
    period_start, period_end = statement_parser.parse_period(full_text)
    declared_sent, declared_received = statement_parser.parse_declared_totals(full_text)
    return page_count, pdf_metadata, full_text, period_start, period_end, declared_sent, declared_received


async def _queue_for_processing(statement: Statement, user_id: str, full_text: str) -> StatementUploadResponse:
    """Creates the job, parks the text for the worker and enqueues ids only.
    A broker failure leaves no phantom in-progress period behind (F15b)."""
    job = await job_repo.create(
        Job(
            user_id=user_id,
            job_type=JobType.STATEMENT_PROCESSING,
            resource_type="statement",
            resource_id=statement.id,
        )
    )
    await statement_repo.set_job(statement.id, job.id)
    # The text waits in Mongo, not in the broker message (F15d): the task
    # carries two ids, and the worker deletes the text when it finishes.
    await db.statement_texts.insert_one(
        {"statement_id": statement.id, "user_id": user_id, "text": full_text, "created_at": datetime.now(UTC)}
    )

    try:
        statement_tasks.process_statement_task.delay(statement.id, job.id)
    except Exception as e:
        # Broker unreachable. Don't leave a phantom in-progress period behind
        # for the stale-job sweep to fail twenty minutes later (F15b): fail it
        # now, drop the parked text, and tell the client to retry.
        logger.exception("Could not dispatch statement %s for processing - broker unreachable.", statement.id)
        message = "Processing queue was unavailable. Please upload this statement again."
        await statement_repo.mark_failed(statement.id, message)
        await job_repo.mark_failed(job.id, message)
        await db.statement_texts.delete_one({"statement_id": statement.id})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Processing queue is currently unavailable. Please try again shortly.",
        ) from e

    logger.info("Statement %s queued for processing (job %s).", statement.id, job.id)
    return StatementUploadResponse(statement_id=statement.id, job_id=job.id, status=statement.processing_status)


@router.post("/upload", response_model=StatementUploadResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/minute")
async def upload_statement(
    request: Request,
    file: UploadFile = File(..., description="A Google Pay 'Transaction statement' PDF"),
    password: str | None = Form(None, description="PDF password, if the statement is password-protected"),
    keep_original_pdf: bool = Form(
        False,
        description="Store the uploaded PDF alongside the parsed data. False keeps only the extracted transactions.",
    ),
    current_user: User = Depends(get_current_user),
):
    """
    Validates the upload is a supported Google Pay statement, then returns
    immediately (202) with a job to poll - GET /jobs/{job_id} - while the
    actual parsing/categorization/analytics/insights pipeline runs in the
    background. The frontend should never block on this request.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="File must be a PDF.")

    limit = settings.MAX_STATEMENT_PDF_BYTES
    chunks: list[bytes] = []
    received = 0
    while chunk := await file.read(1024 * 1024):
        received += len(chunk)
        if received > limit:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"PDF exceeds the {limit // (1024 * 1024)} MB limit.",
            )
        chunks.append(chunk)
    raw_bytes = b"".join(chunks)

    try:
        validate_pdf_upload(
            raw_bytes,
            content_type=file.content_type,
            filename=file.filename,
            max_size=settings.MAX_STATEMENT_PDF_BYTES,
        )
    except PDFValidationError as e:
        logger.warning(f"PDF validation failed for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"PDF validation failed: {str(e)}"
        ) from e

    try:
        # pdfplumber is pure-Python and CPU-bound (seconds per statement, far
        # longer on a busy host) - run it on a worker thread, or every other
        # request to this single-process server stalls until it finishes.
        page_count, pdf_metadata, full_text, period_start, period_end, declared_sent, declared_received = (
            await asyncio.to_thread(_inspect_statement_pdf, raw_bytes, password)
        )
    except (CorruptedPDFError, PasswordRequiredError, IncorrectPasswordError, UnsupportedStatementError) as e:
        code = {
            CorruptedPDFError: "corrupted_pdf",
            PasswordRequiredError: "password_required",
            IncorrectPasswordError: "incorrect_password",
            UnsupportedStatementError: "unsupported_statement",
        }[type(e)]
        raise CodedHTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e), code) from e

    # The same file twice would only merge into itself; say so instead (A1).
    content_sha256 = hashlib.sha256(raw_bytes).hexdigest()
    duplicate = await statement_repo.find_duplicate(current_user.id, content_sha256)
    if duplicate is not None:
        raise CodedHTTPException(
            status.HTTP_409_CONFLICT,
            "You already added this statement.",
            "duplicate_statement",
            statement_id=duplicate.id,
        )

    gridfs_file_id = await statement_repo.store_pdf(raw_bytes, file.filename) if keep_original_pdf else None

    statement = await statement_repo.create(
        Statement(
            user_id=current_user.id,
            original_filename=file.filename,
            file_size_bytes=len(raw_bytes),
            page_count=page_count,
            pdf_metadata=pdf_metadata or None,
            gridfs_file_id=gridfs_file_id,
            period_start=period_start,
            period_end=period_end,
            declared_sent_amount=declared_sent,
            declared_received_amount=declared_received,
            content_sha256=content_sha256,
        )
    )

    return await _queue_for_processing(statement, current_user.id, full_text)


@router.post("/sample", response_model=StatementUploadResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def add_sample_statement(request: Request, current_user: User = Depends(get_current_user)):
    """
    Adds a generated statement covering the last three full months, so a
    new user can see the whole product before trusting it with their own
    bank data (PROJECT_AUDIT.md E1). It goes through the same pipeline as an
    upload, is labelled `is_sample`, and is deleted like any other period.
    One per account at a time.
    """
    existing = await db.statements.find_one({"user_id": current_user.id, "is_sample": True}, {"_id": 1})
    if existing is not None:
        raise CodedHTTPException(
            status.HTTP_409_CONFLICT,
            "You already have the sample period.",
            "duplicate_statement",
            statement_id=str(existing["_id"]),
        )

    today = local_date(datetime.now(UTC))
    end = today.replace(day=1) - timedelta(days=1)
    start = (end.replace(day=1) - timedelta(days=62)).replace(day=1)
    # Seeded from the account, so each user gets a stable but different sample.
    seed = int(hashlib.sha256(current_user.id.encode()).hexdigest()[:8], 16)
    text = await asyncio.to_thread(lambda: SyntheticStatement(start, end, seed=seed).text())
    declared_sent, declared_received = statement_parser.parse_declared_totals(text)

    statement = await statement_repo.create(
        Statement(
            user_id=current_user.id,
            original_filename="Sample statement",
            file_size_bytes=len(text.encode()),
            period_start=start,
            period_end=end,
            declared_sent_amount=declared_sent,
            declared_received_amount=declared_received,
            content_sha256=hashlib.sha256(text.encode()).hexdigest(),
            is_sample=True,
        )
    )
    return await _queue_for_processing(statement, current_user.id, text)


@router.get("", response_model=StatementListResponse)
async def list_statements(
    pagination: PaginationParams = Depends(),
    processing_status: StatementStatus | None = Query(None),
    sort_by: str = Query("uploaded_at"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
):
    items, total = await statement_repo.list_for_user(
        current_user.id,
        pagination.page,
        pagination.page_size,
        status_filter=processing_status,
        sort_by=sort_by,
        sort_order=resolve_sort_order(sort_order),
    )
    return StatementListResponse(
        items=[_to_statement_response(s) for s in items],
        page=pagination.page,
        page_size=pagination.page_size,
        total=total,
        total_pages=total_pages(total, pagination.page_size),
    )


@router.get("/{statement_id}", response_model=StatementResponse)
async def get_statement(statement_id: str, current_user: User = Depends(get_current_user)):
    statement = await _get_owned_statement(statement_id, current_user)
    return _to_statement_response(statement)


@router.delete("/{statement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_statement(statement_id: str, current_user: User = Depends(get_current_user)):
    """Removes this statement as a source. Transactions another statement
    still vouches for stay (A1); the rest go, with the job history and the
    retained PDF. Periods that overlapped or compared against it are
    recomputed, and this user's behaviour profiles are refreshed."""
    statement = await _get_owned_statement(statement_id, current_user)

    sharing = await transaction_repo.statement_ids_sharing(current_user.id, statement_id)
    await transaction_repo.delete_for_statement(statement_id, current_user.id)
    await db.statement_texts.delete_one({"statement_id": statement_id})
    await job_repo.delete_for_resource(statement_id)
    if statement.gridfs_file_id:
        await statement_repo.delete_pdf(statement.gridfs_file_id)
    await statement_repo.delete(statement_id)

    later = [
        s.id for s in await statement_repo.list_completed_for_user(current_user.id)
        if s.period_start > statement.period_start
    ]
    await recompute_statements(current_user.id, sharing + later)
    await behavior_engine.profile_user(current_user.id)


@router.post("/{statement_id}/viewed", status_code=status.HTTP_204_NO_CONTENT)
async def mark_statement_viewed(statement_id: str, current_user: User = Depends(get_current_user)):
    """Fired once by the client when a period's Overview is first shown.
    Powers the admin activation-funnel's "time to insight" metric
    (analytics/activation_metrics.py) - idempotent, so the client can call
    it on every Overview mount with no extra bookkeeping on its side."""
    await _get_owned_statement(statement_id, current_user)
    await statement_repo.mark_first_viewed(statement_id)


@router.get("/{statement_id}/transactions", response_model=TransactionListResponse)
async def list_statement_transactions(
    statement_id: str,
    pagination: PaginationParams = Depends(),
    category: str | None = Query(None),
    transaction_type: TransactionType | None = Query(None),
    merchant: str | None = Query(None, description="Case-insensitive substring match"),
    q: str | None = Query(None, max_length=100, description="Search merchant, payee name, UPI reference or amount"),
    start_date: str | None = Query(None, description="ISO 8601 date, inclusive"),
    end_date: str | None = Query(None, description="ISO 8601 date, inclusive"),
    sort_by: str = Query("timestamp"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
):
    statement = await _get_owned_statement(statement_id, current_user)
    start, end_exclusive = _parse_date_range(start_date, end_date)

    items, total = await transaction_repo.list_for_statement(
        statement.id,
        current_user.id,
        pagination.page,
        pagination.page_size,
        category=category,
        transaction_type=transaction_type,
        merchant=merchant,
        q=q,
        start=start,
        end_exclusive=end_exclusive,
        sort_by=sort_by,
        sort_order=resolve_sort_order(sort_order),
    )
    return TransactionListResponse(
        items=[TransactionResponse.from_transaction(t) for t in items],
        page=pagination.page,
        page_size=pagination.page_size,
        total=total,
        total_pages=total_pages(total, pagination.page_size),
    )


def _parse_date_range(start_date: str | None, end_date: str | None) -> tuple[datetime | None, datetime | None]:
    """Local calendar dates, both inclusive (F25): end_date covers that
    whole day, and a malformed date is a 422, not a 500."""
    try:
        start = start_of_local_day(date.fromisoformat(start_date[:10])) if start_date else None
        end = end_of_local_day_exclusive(date.fromisoformat(end_date[:10])) if end_date else None
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Dates must be YYYY-MM-DD."
        ) from e
    return start, end


def _require_completed(statement: Statement) -> None:
    if statement.processing_status != StatementStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Statement is not yet processed (status: {statement.processing_status.value}). "
                f"Check GET /jobs/{statement.current_job_id} for progress."
            ),
        )


@router.get("/{statement_id}/analytics", response_model=StatementAnalyticsResponse)
async def get_statement_analytics(statement_id: str, current_user: User = Depends(get_current_user)):
    """Reads the analytics computed once during job processing
    (analytics/statement_analytics.py) - never recomputed per-request."""
    statement = await _get_owned_statement(statement_id, current_user)
    _require_completed(statement)
    return StatementAnalyticsResponse(statement_id=statement.id, **statement.analytics.model_dump())


@router.get("/{statement_id}/insights", response_model=StatementInsightsResponse)
async def get_statement_insights(statement_id: str, current_user: User = Depends(get_current_user)):
    """Reads the insights generated once during job processing
    (insights/statement_insights.py) - no LLM call happens on this request."""
    statement = await _get_owned_statement(statement_id, current_user)
    _require_completed(statement)
    return StatementInsightsResponse(statement_id=statement.id, insights=statement.insights)
