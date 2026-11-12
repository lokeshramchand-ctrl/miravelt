from datetime import UTC, date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class CoreModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class UserRole(str, Enum):
    """Authorization role, not identity. Only "admin" changes anything today
    (routers/auth.py grants the JWT "admin" scope to it) - there is
    deliberately no self-serve API to set this on your own account; the
    first admin is bootstrapped with scripts/create_admin.py, and every
    admin after that is promoted by an existing one via
    PATCH /admin/users/{user_id}/role."""
    USER = "user"
    ADMIN = "admin"


class DeviceSession(BaseModel):
    """Per-device session tracking for per-user/device authorization."""
    device_id: str = Field(description="Unique device identifier (hashed)")
    device_name: str = Field(description="User-friendly device name", default="Unknown Device")
    user_agent: str | None = Field(description="Device user agent", default=None)
    ip_address: str | None = Field(description="IP address from login", default=None)
    last_login: datetime = Field(default_factory=lambda: datetime.now(UTC))
    is_trusted: bool = Field(default=False, description="Trusted devices skip MFA")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    attestation_verified: bool = Field(default=False, description="Device has passed attestation")
    attestation_type: str | None = Field(default=None, description="'play_integrity' or 'app_attest'")
    attestation_at: datetime | None = Field(default=None, description="Last successful attestation timestamp")


class User(CoreModel):
    """Persisted shape of a `users` document. `hashed_password` never leaves
    this model - API responses use `UserPublic` instead (see below)."""
    id: str | None = Field(alias="_id", default=None)
    email: EmailStr
    hashed_password: str
    full_name: str | None = None
    is_active: bool = True
    role: UserRole = UserRole.USER
    devices: list[DeviceSession] = Field(default_factory=list, description="Tracked devices")
    # Account lifecycle (PROJECT_AUDIT.md D3). `password_changed_at` invalidates
    # access tokens issued before a password change or reset (core/jwt_auth.py).
    email_verified: bool = False
    password_changed_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    def to_public(self) -> "UserPublic":
        # Explicit field-by-field mapping rather than UserPublic(**self.model_dump())
        # so a future field added here (e.g. an MFA secret) can never leak
        # into a response just because someone forgot to also update this.
        return UserPublic(
            id=self.id, email=self.email, full_name=self.full_name,
            is_active=self.is_active, created_at=self.created_at, email_verified=self.email_verified,
        )


class UserPublic(BaseModel):
    """Safe, external-facing view of a User - deliberately a separate model
    (not User with a field excluded) so a future field added to User can
    never leak into a response by accident."""
    id: str
    email: EmailStr
    full_name: str | None
    is_active: bool
    created_at: datetime
    email_verified: bool = False


class UpdateUserRequest(BaseModel):
    """Email is deliberately not editable here - changing it is a bigger
    reverification flow (confirm the new address, re-check the uniqueness
    index) than a simple profile PATCH, and isn't required by anything this
    API needs to support yet."""
    full_name: str | None = Field(default=None, min_length=1, max_length=200)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        # Prevents "Foo@x.com" and "foo@x.com" from registering as two
        # distinct accounts against the case-sensitive unique index on email.
        return v.lower()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)
    device_id: str | None = Field(default=None, max_length=128, description="Unique device identifier for device tracking")
    device_name: str | None = Field(default=None, max_length=100, description="User-friendly device name")
    user_agent: str | None = Field(default=None, description="Device user agent string")
    ip_address: str | None = Field(default=None, description="Client IP address")
    attestation_token: str | None = Field(default=None, description="Play Integrity / App Attest token")
    attestation_type: str | None = Field(default=None, description="'play_integrity' or 'app_attest'")
    attestation_nonce: str | None = Field(default=None, description="Nonce used for attestation")

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return v.lower()


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105 - the OAuth2/RFC 6750 scheme name, not a credential
    expires_in: int = Field(description="Access token lifetime in seconds")


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, max_length=1024)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, max_length=1024)

class TransactionType(str, Enum):
    DEBIT = "DEBIT"    # money out ("Paid to" on a Google Pay statement)
    CREDIT = "CREDIT"  # money in ("Received from")


class TransactionStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PENDING = "PENDING"


class Transaction(CoreModel):
    id: str | None = Field(alias="_id", default=None)
    raw_text: str
    merchant: str | None = None
    amount: float
    category: str | None = None
    user_id: str = "system_user"
    is_mock: bool = False
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Statement-derived fields (statements/statement_service.py). All optional/
    # defaulted so the existing POST /v1/categorize write path (routers/v1.py),
    # which only ever sets the fields above, needs no changes at all.
    statement_id: str | None = None
    # Timeline model (PROJECT_AUDIT.md A1): a transaction belongs to its
    # *user*; statements are sources that vouch for it. Two overlapping
    # uploads both list themselves here instead of the later one taking the
    # row over, and deleting a statement only deletes rows no other
    # statement still vouches for. `statement_id` stays as the first source,
    # for older clients and the admin dashboard.
    source_statement_ids: list[str] = Field(default_factory=list)
    transaction_type: TransactionType = TransactionType.DEBIT
    status: TransactionStatus = TransactionStatus.SUCCESS
    counterparty_raw: str | None = None  # the raw "Paid to X" / "Received from X" name, pre-categorization
    reference_number: str | None = None  # UPI Transaction ID - also the dedup key, see database/mongo.py
    bank: str | None = None
    account_last4: str | None = None
    payment_method: str = "UPI"
    # How the category was decided: 0.95 known-merchant alias, 0.6 business
    # keyword in the payee name, 0.0 no match (Uncategorized), 1.0 a user
    # correction; None for incoming money and for rows stored before this
    # field existed. Lets the app say *how* a category was decided.
    categorization_confidence: float | None = None
    # Where the category came from - see engines/categorizer.py. "user" (a
    # correction; never overwritten by a later upload), "user_memory" (this
    # user's earlier correction for the same payee), "alias", "community",
    # "keyword", "suggestion", "none", or "income".
    categorization_source: str | None = None
    # "person" or "business" - engines/counterparty.py. People get their own
    # ledger and are never promoted to a shared alias.
    counterparty_kind: str | None = None
    # Free-text note and tags the user attaches (PROJECT_AUDIT.md D8).
    note: str | None = None
    tags: list[str] = Field(default_factory=list)


class Feedback(CoreModel):
    id: str | None = Field(alias="_id", default=None)
    transaction_id: str
    merchant_name: str | None = None
    prediction: str
    corrected_category: str
    confidence: float
    is_correction: bool = False
    user_id: str = "system_user"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))

class CategorizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Raw transaction SMS or bank statement text")

class CategorizeResponse(BaseModel):
    merchant: str
    category: str
    confidence: float
    transaction_id: str | None = None

class ResolutionResult(BaseModel):
    raw_text: str
    cleaned_text: str
    canonical_merchant: str
    confidence: float
    is_resolved: bool
    resolution_method: str = Field(description="exact_alias, substring, or none")


class MemoryState(str, Enum):
    EPHEMERAL = "EPHEMERAL"
    TEMPORARY = "TEMPORARY"
    PERMANENT = "PERMANENT"
    ARCHIVED = "ARCHIVED"

class MerchantProfile(BaseModel):
    id: str | None = Field(alias="_id", default=None)
    canonical_name: str
    display_name: str | None = None
    aliases: list[str] = Field(default_factory=list)
    entity_type: str = "Unknown"  # e.g., "Individual", "Business"

    # Phase 4 Core Variables
    memory_state: MemoryState = MemoryState.EPHEMERAL
    frequency: int = 1
    first_seen: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_seen: datetime = Field(default_factory=lambda: datetime.now(UTC))

    notes: str | None = None
    confidence: float = 0.0
    category: str | None = None
    subcategory: str | None = None



class TransactionCategory(str, Enum):
    FOOD = "Food"
    TRAVEL = "Travel"
    ENTERTAINMENT = "Entertainment"
    BILLS = "Bills"
    FRIENDS = "Friends"
    EDUCATION = "Education"
    HEALTHCARE = "Healthcare"
    SUBSCRIPTION = "Subscription"
    SHOPPING = "Shopping"
    UTILITY = "Utility"
    INCOME = "Income"  # CREDIT transactions (money received) - not run through the expense rule engine, see statements/statement_service.py
    # The rule engine has always written "Uncategorized"; the app's picker
    # said "Unknown". Both are accepted, "Uncategorized" is canonical and
    # feedback normalises "Unknown" to it (PROJECT_AUDIT.md F4).
    UNCATEGORIZED = "Uncategorized"
    UNKNOWN = "Unknown"

class ConfidenceEvaluation(BaseModel):
    raw_category: str
    final_category: TransactionCategory
    confidence: float
    is_hallucination_risk: bool
    calibration_applied: str

class BehaviorPattern(BaseModel):
    id: str | None = Field(alias="_id", default=None)
    merchant_name: str  # Can be a resolved name or an "Unknown" entity string
    # Per-user (PROJECT_AUDIT.md A2/F5): profiles were once pooled across
    # every user who paid a merchant, which both leaked private payees
    # between accounts and destroyed periodicity (forty monthly payers on
    # different days look like a daily burst). Unique on (user_id, merchant_name).
    user_id: str | None = None

    # Statistical Amount Metrics
    avg_amount: float
    median_amount: float
    variance: float
    std_dev: float

    # Temporal & Frequency Metrics
    preferred_hour: int
    time_bucket_distribution: dict[str, float]  # e.g., {"morning": 0.7, "night": 0.3}
    weekday_distribution: list[float]          # Length 7 array representing normalized frequency per day
    daily_frequency: float                     # Average number of times seen per day
    weekly_frequency: float                    # Average number of times seen per week

    # Advanced Intelligence Metrics
    periodicity_score: float                   # 0.0 (highly random) to 1.0 (perfectly predictable interval)
    entropy_score: float                       # Measures predictability of spending amounts
    last_updated: datetime = Field(default_factory=lambda: datetime.now(UTC))


# =====================================================================
# Statement ingestion: Statement -> Transactions -> Analytics -> Insights
# (statements/*, analytics/statement_analytics.py, insights/*, routers/statements.py)
# =====================================================================

class StatementStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class JobType(str, Enum):
    STATEMENT_PROCESSING = "STATEMENT_PROCESSING"


class InsightSeverity(str, Enum):
    INFO = "INFO"
    POSITIVE = "POSITIVE"
    WARNING = "WARNING"


class CategoryBreakdownItem(BaseModel):
    category: str
    total_amount: float
    count: int


class MerchantSpendItem(BaseModel):
    merchant: str
    total_amount: float
    count: int


class DailyTrendItem(BaseModel):
    date: date
    total_amount: float
    count: int


class RecurringPaymentItem(BaseModel):
    """One detected recurring payment - analytics/recurring.py."""
    merchant: str
    # Monthly equivalent of the typical amount at the detected cadence
    # (weekly x 4.35, quarterly / 3, ...). Name kept for older clients.
    estimated_monthly_cost: float
    # Regularity of the payment gaps, 0..1 (share of gaps on cadence).
    periodicity_score: float
    occurrences: int
    cadence: str = "monthly"  # weekly | fortnightly | monthly | quarterly | yearly
    cadence_days: float = 30.44
    typical_amount: float = 0.0  # median of the most recent payments
    last_amount: float = 0.0
    last_paid_at: datetime | None = None
    next_expected_at: datetime | None = None
    # Change of the latest amount against the typical amount before it, as a
    # fraction (0.25 = 25% more). None when there is no earlier baseline.
    amount_change: float | None = None
    # Monthly equivalent as a share of this period's average monthly spend.
    share_of_monthly_spend: float | None = None


class StatementAnalytics(BaseModel):
    """Computed once by statements/statement_service.py during job processing
    and persisted onto the Statement document - GET /statements/{id}/analytics
    reads this back directly rather than recomputing an aggregation on every
    request."""
    total_spend: float = 0.0
    total_income: float = 0.0
    net: float = 0.0
    average_transaction_value: float = 0.0
    transaction_count: int = 0
    failed_transaction_count: int = 0  # honestly 0 for Google Pay statements - see statements/pdf_parser.py
    category_breakdown: list[CategoryBreakdownItem] = Field(default_factory=list)
    top_merchants: list[MerchantSpendItem] = Field(default_factory=list)
    daily_trend: list[DailyTrendItem] = Field(default_factory=list)
    recurring_payments: list[RecurringPaymentItem] = Field(default_factory=list)
    # Average spend per month over the period (total_spend / months covered),
    # the honest denominator for a monthly recurring cost's share.
    average_monthly_spend: float = 0.0
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class InsightItem(BaseModel):
    type: str
    message: str
    severity: InsightSeverity = InsightSeverity.INFO
    # "computed" (read straight off the analytics) or "llm" (generated, and
    # admitted only after insights/fact_check.py found every figure and name
    # in the context). Lets a recompute replace computed items and re-verify
    # generated ones instead of calling the model again.
    origin: str = "computed"


class Statement(CoreModel):
    id: str | None = Field(alias="_id", default=None)
    user_id: str
    original_filename: str
    file_size_bytes: int
    page_count: int | None = None
    pdf_metadata: dict[str, str] | None = None
    gridfs_file_id: str | None = None

    # Parsed from the statement itself, not assumed - see docs/23-statements-pipeline.md:
    # a Google Pay statement's period can span multiple calendar months, so
    # there is deliberately no single "statement_month"/"statement_year" field.
    period_start: date
    period_end: date

    # Reconciliation: declared_* comes from the statement's own Sent/Received
    # header; computed_* is the sum of what was actually parsed. Mismatch
    # beyond a small epsilon is a real signal something was missed - see
    # statements/statement_service.py.
    declared_sent_amount: float | None = None
    declared_received_amount: float | None = None
    computed_sent_amount: float | None = None
    computed_received_amount: float | None = None
    reconciliation_ok: bool | None = None

    transaction_count: int = 0
    processing_status: StatementStatus = StatementStatus.PENDING
    current_job_id: str | None = None
    error_message: str | None = None

    analytics: StatementAnalytics | None = None
    insights: list[InsightItem] = Field(default_factory=list)
    analytics_version: str = "1.0"

    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    processing_started_at: datetime | None = None
    processing_completed_at: datetime | None = None
    processing_duration_ms: int | None = None

    # Set once, the first time the client shows this period's Overview - the
    # only backend-visible signal for "time to insight" (upload -> first
    # viewed), since viewing a screen otherwise leaves no server-side trace.
    # See repositories/statement_repository.py::mark_first_viewed.
    first_viewed_at: datetime | None = None
    # sha256 of the uploaded bytes - an identical re-upload is refused with
    # a pointer to the existing period (PROJECT_AUDIT.md A1).
    content_sha256: str | None = None
    # Parser accounting (PROJECT_AUDIT.md A6/F9): lines that start a record
    # but did not parse. Non-zero is shown in the app and the admin dashboard.
    record_line_count: int | None = None
    unparsed_count: int | None = None
    # Bumped whenever analytics are recomputed (corrections, merges), so the
    # client can tell a cached copy is stale.
    analytics_revision: int = 0
    # A generated demo statement (POST /statements/sample, PROJECT_AUDIT.md E1),
    # not the user's own money. Labelled in the app, left out of product metrics.
    is_sample: bool = False


class Job(CoreModel):
    id: str | None = Field(alias="_id", default=None)
    user_id: str
    job_type: JobType
    resource_type: str = "statement"
    resource_id: str
    status: JobStatus = JobStatus.QUEUED
    stage: str | None = None  # e.g. "parsing", "categorizing", "generating_insights"
    progress_percent: int = 0
    error_message: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    started_at: datetime | None = None
    completed_at: datetime | None = None


class StatementUploadResponse(BaseModel):
    statement_id: str
    job_id: str
    status: StatementStatus


class StatementResponse(BaseModel):
    id: str
    original_filename: str
    file_size_bytes: int
    page_count: int | None
    period_start: date
    period_end: date
    declared_sent_amount: float | None
    declared_received_amount: float | None
    computed_sent_amount: float | None
    computed_received_amount: float | None
    reconciliation_ok: bool | None
    unparsed_count: int | None = None
    analytics_revision: int = 0
    is_sample: bool = False
    transaction_count: int
    processing_status: StatementStatus
    current_job_id: str | None
    error_message: str | None
    analytics_version: str
    uploaded_at: datetime
    processing_completed_at: datetime | None
    processing_duration_ms: int | None


class StatementListResponse(BaseModel):
    items: list[StatementResponse]
    page: int
    page_size: int
    total: int
    total_pages: int


class TransactionResponse(BaseModel):
    id: str
    statement_id: str | None
    timestamp: datetime
    merchant: str | None
    category: str | None
    amount: float
    transaction_type: TransactionType
    status: TransactionStatus
    counterparty_raw: str | None
    reference_number: str | None
    bank: str | None
    account_last4: str | None
    payment_method: str
    categorization_confidence: float | None = None
    categorization_source: str | None = None
    counterparty_kind: str | None = None
    note: str | None = None
    tags: list[str] = Field(default_factory=list)

    @classmethod
    def from_transaction(cls, t: "Transaction") -> "TransactionResponse":
        return cls(
            id=t.id, statement_id=t.statement_id, timestamp=t.timestamp, merchant=t.merchant,
            category=t.category, amount=t.amount, transaction_type=t.transaction_type, status=t.status,
            counterparty_raw=t.counterparty_raw, reference_number=t.reference_number, bank=t.bank,
            account_last4=t.account_last4, payment_method=t.payment_method,
            categorization_confidence=t.categorization_confidence,
            categorization_source=t.categorization_source, counterparty_kind=t.counterparty_kind,
            note=t.note, tags=t.tags,
        )


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    page: int
    page_size: int
    total: int
    total_pages: int


class AppPlatform(str, Enum):
    ANDROID = "android"


class AppRelease(CoreModel):
    """A single uploaded build (routers/app_updates.py, self-hosted app
    updater - no Play Store, no Shorebird account). The APK bytes live in
    GridFS (database/mongo.py's app_releases_bucket); this is metadata only."""
    id: str | None = Field(alias="_id", default=None)
    platform: AppPlatform = AppPlatform.ANDROID
    version_code: int  # Android versionCode - the only value the client compares to decide "is this newer"
    version_name: str  # Android versionName - human-facing, e.g. "1.2.0"
    release_notes: str = ""
    min_supported_version_code: int | None = None  # below this, the client should treat the update as mandatory
    gridfs_file_id: str
    sha256: str
    size_bytes: int
    is_latest: bool = True
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AppReleaseResponse(BaseModel):
    platform: AppPlatform
    version_code: int
    version_name: str
    release_notes: str
    min_supported_version_code: int | None
    sha256: str
    size_bytes: int
    uploaded_at: datetime
    download_url: str


class StatementAnalyticsResponse(StatementAnalytics):
    statement_id: str


class StatementInsightsResponse(BaseModel):
    statement_id: str
    insights: list[InsightItem]


class JobResponse(BaseModel):
    id: str
    job_type: JobType
    resource_type: str
    resource_id: str
    status: JobStatus
    stage: str | None
    progress_percent: int
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
