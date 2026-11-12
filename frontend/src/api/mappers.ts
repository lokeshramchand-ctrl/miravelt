import { parseApiDate } from '../lib/format';
import type {
  AnomalyCheckResult,
  Cadence,
  RecurringPaymentEntry,
  AppUpdateInfo,
  CategoryPatternEntry,
  DailyTrendEntry,
  ExplainOutcome,
  Insight,
  Job,
  MerchantPage,
  MerchantPatternEntry,
  MoMTrend,
  Paged,
  PersonLedgerRow,
  Statement,
  StatementAnalytics,
  StatementInsights,
  StatementUploadResponse,
  SubscriptionDetail,
  SubscriptionsSummary,
  TeachDeck,
  Transaction,
  User,
} from '../domain/types';

type Json = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? '' : String(v));
const strOrNull = (v: unknown): string | null => (v == null ? null : String(v));
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : v == null ? fallback : Number(v) || fallback);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const date = (v: unknown): Date => parseApiDate(str(v));
const dateOrNull = (v: unknown): Date | null => (v == null ? null : parseApiDate(str(v)));
const list = <T>(v: unknown, f: (j: Json) => T): T[] => (Array.isArray(v) ? v.map((e) => f(e as Json)) : []);

export const mapUser = (j: Json): User => ({
  id: str(j.id),
  email: str(j.email),
  fullName: strOrNull(j.full_name),
  isActive: Boolean(j.is_active),
  createdAt: date(j.created_at),
  emailVerified: Boolean(j.email_verified),
});

export const mapStatement = (j: Json): Statement => ({
  id: str(j.id),
  originalFilename: str(j.original_filename),
  fileSizeBytes: num(j.file_size_bytes),
  pageCount: numOrNull(j.page_count),
  periodStart: date(j.period_start),
  periodEnd: date(j.period_end),
  declaredSentAmount: numOrNull(j.declared_sent_amount),
  declaredReceivedAmount: numOrNull(j.declared_received_amount),
  computedSentAmount: numOrNull(j.computed_sent_amount),
  computedReceivedAmount: numOrNull(j.computed_received_amount),
  reconciliationOk: j.reconciliation_ok == null ? null : Boolean(j.reconciliation_ok),
  transactionCount: num(j.transaction_count),
  processingStatus: str(j.processing_status) as Statement['processingStatus'],
  currentJobId: strOrNull(j.current_job_id),
  errorMessage: strOrNull(j.error_message),
  analyticsVersion: str(j.analytics_version),
  uploadedAt: date(j.uploaded_at),
  processingCompletedAt: dateOrNull(j.processing_completed_at),
  processingDurationMs: numOrNull(j.processing_duration_ms),
  unparsedCount: numOrNull(j.unparsed_count),
  analyticsRevision: num(j.analytics_revision),
  isSample: Boolean(j.is_sample),
});

export const mapPaged = <T>(j: Json, f: (j: Json) => T): Paged<T> => ({
  items: list(j.items, f),
  page: num(j.page, 1),
  pageSize: num(j.page_size),
  total: num(j.total),
  totalPages: num(j.total_pages),
});

export const mapUploadResponse = (j: Json): StatementUploadResponse => ({
  statementId: str(j.statement_id),
  jobId: str(j.job_id),
  status: str(j.status) as StatementUploadResponse['status'],
});

export const mapTransaction = (j: Json): Transaction => ({
  id: str(j.id),
  statementId: strOrNull(j.statement_id),
  timestamp: date(j.timestamp),
  merchant: strOrNull(j.merchant),
  category: strOrNull(j.category),
  amount: num(j.amount),
  transactionType: str(j.transaction_type) as Transaction['transactionType'],
  status: str(j.status) as Transaction['status'],
  counterpartyRaw: strOrNull(j.counterparty_raw),
  referenceNumber: strOrNull(j.reference_number),
  bank: strOrNull(j.bank),
  accountLast4: strOrNull(j.account_last4),
  paymentMethod: str(j.payment_method),
  categorizationConfidence: numOrNull(j.categorization_confidence),
  categorizationSource: strOrNull(j.categorization_source),
  counterpartyKind: j.counterparty_kind === 'person' || j.counterparty_kind === 'business' ? j.counterparty_kind : null,
  note: strOrNull(j.note),
  tags: Array.isArray(j.tags) ? j.tags.map(String) : [],
});

export const mapJob = (j: Json): Job => ({
  id: str(j.id),
  jobType: str(j.job_type),
  resourceType: str(j.resource_type),
  resourceId: str(j.resource_id),
  status: str(j.status) as Job['status'],
  stage: strOrNull(j.stage),
  progressPercent: num(j.progress_percent),
  errorMessage: strOrNull(j.error_message),
  createdAt: date(j.created_at),
  startedAt: dateOrNull(j.started_at),
  completedAt: dateOrNull(j.completed_at),
});

const mapInsight = (j: Json): Insight => ({
  type: str(j.type),
  message: str(j.message),
  severity: str(j.severity) as Insight['severity'],
  origin: j.origin === 'llm' ? 'llm' : 'computed',
});

export const mapInsights = (j: Json): StatementInsights => ({
  statementId: str(j.statement_id),
  insights: list(j.insights, mapInsight),
});

const CADENCES: readonly Cadence[] = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'];
const cadence = (v: unknown): Cadence => (CADENCES.includes(v as Cadence) ? (v as Cadence) : 'monthly');

export const mapRecurring = (e: Json): RecurringPaymentEntry => ({
  merchant: str(e.merchant),
  estimatedMonthlyCost: num(e.estimated_monthly_cost),
  periodicityScore: num(e.periodicity_score),
  occurrences: num(e.occurrences),
  cadence: cadence(e.cadence),
  cadenceDays: num(e.cadence_days, 30.44),
  // Older stored analytics have no per-charge amount; the monthly figure was the charge.
  typicalAmount: num(e.typical_amount) || num(e.estimated_monthly_cost),
  lastAmount: num(e.last_amount) || num(e.estimated_monthly_cost),
  lastPaidAt: dateOrNull(e.last_paid_at),
  nextExpectedAt: dateOrNull(e.next_expected_at),
  amountChange: numOrNull(e.amount_change),
  shareOfMonthlySpend: numOrNull(e.share_of_monthly_spend),
});

const mapDaily = (j: Json): DailyTrendEntry => ({ date: date(j.date), totalAmount: num(j.total_amount), count: num(j.count) });

export const mapStatementAnalytics = (j: Json): StatementAnalytics => ({
  statementId: str(j.statement_id),
  totalSpend: num(j.total_spend),
  totalIncome: num(j.total_income),
  net: num(j.net),
  averageTransactionValue: num(j.average_transaction_value),
  transactionCount: num(j.transaction_count),
  failedTransactionCount: num(j.failed_transaction_count),
  categoryBreakdown: list(j.category_breakdown, (e) => ({ category: str(e.category), totalAmount: num(e.total_amount), count: num(e.count) })),
  topMerchants: list(j.top_merchants, (e) => ({ merchant: str(e.merchant), totalAmount: num(e.total_amount), count: num(e.count) })),
  dailyTrend: list(j.daily_trend, mapDaily),
  recurringPayments: list(j.recurring_payments, mapRecurring),
  averageMonthlySpend: num(j.average_monthly_spend),
  generatedAt: date(j.generated_at),
});

export const mapCategoryPattern = (j: Json): CategoryPatternEntry => ({
  category: j.category == null ? 'Unknown' : str(j.category),
  totalAmount: num(j.total_amount),
  count: num(j.count),
});

export const mapMerchantPattern = (j: Json): MerchantPatternEntry => ({
  merchant: strOrNull(j.merchant),
  visits: num(j.visits),
  spent: num(j.spent),
});

const mapSubscriptionDetail = (j: Json): SubscriptionDetail => ({
  merchant: str(j.merchant),
  estimatedMonthlyCost: num(j.estimated_monthly_cost),
  periodicityScore: num(j.periodicity_score),
  lastBilled: dateOrNull(j.last_billed),
  cadence: cadence(j.cadence),
  typicalAmount: num(j.typical_amount) || num(j.estimated_monthly_cost),
  nextExpectedAt: dateOrNull(j.next_expected_at),
});

export const mapSubscriptions = (j: Json): SubscriptionsSummary => ({
  activeSubscriptions: num(j.active_subscriptions),
  totalMonthlyBurn: num(j.total_monthly_burn),
  details: list(j.details, mapSubscriptionDetail),
});

export const mapMoM = (j: Json): MoMTrend => ({
  currentSpend: num(j.current_spend),
  previousSpend: num(j.previous_spend),
  momGrowthPercentage: num(j.mom_growth_percentage),
  trend: j.trend == null ? 'flat' : str(j.trend),
});

export const mapAnomaly = (j: Json): AnomalyCheckResult => ({
  isAnomaly: Boolean(j.is_anomaly),
  reason: str(j.reason),
  confidence: numOrNull(j.confidence),
});

export function mapExplain(json: Json): ExplainOutcome {
  const result = (json.result as Json | undefined) ?? {};
  if (typeof result.error === 'string') return { available: false, unavailableReason: result.error };
  const facts = Array.isArray(json.facts) ? json.facts.map(String) : [];
  return {
    available: true,
    explanation: typeof result.explanation === 'string' ? result.explanation : facts.join(' ') || 'No explanation returned.',
    confidence: strOrNull(result.confidence_in_explanation),
    primarySource: strOrNull(result.primary_data_source),
    facts,
    generated: result.generated === true,
  };
}

const kind = (v: unknown): 'person' | 'business' | null => (v === 'person' || v === 'business' ? v : null);

export const mapTeachDeck = (j: Json): TeachDeck => ({
  unknownTotal: num(j.unknown_total),
  unknownPayees: num(j.unknown_payees),
  coveredTotal: num(j.covered_total),
  coveredShare: num(j.covered_share),
  cards: list(j.cards, (c) => ({
    merchant: str(c.merchant),
    totalAmount: num(c.total_amount),
    count: num(c.count),
    payeeNames: Array.isArray(c.payee_names) ? c.payee_names.map(String) : [],
    counterpartyKind: kind(c.counterparty_kind),
    lastPaidAt: dateOrNull(c.last_paid_at),
    shareOfUnknown: num(c.share_of_unknown),
    suggestedCategory: strOrNull(c.suggested_category),
    similarNames: Array.isArray(c.similar_names) ? c.similar_names.map(String) : [],
  })),
});

export const mapPerson = (j: Json): PersonLedgerRow => ({
  payeeKey: str(j.payee_key),
  name: str(j.name),
  sent: num(j.sent),
  received: num(j.received),
  net: num(j.net),
  count: num(j.count),
  firstAt: date(j.first_at),
  lastAt: date(j.last_at),
});

export const mapMerchantPage = (j: Json): MerchantPage => ({
  merchant: str(j.merchant),
  category: strOrNull(j.category),
  counterpartyKind: kind(j.counterparty_kind),
  payeeNames: Array.isArray(j.payee_names) ? j.payee_names.map(String) : [],
  totalSpent: num(j.total_spent),
  totalReceived: num(j.total_received),
  paymentCount: num(j.payment_count),
  averagePayment: num(j.average_payment),
  firstAt: date(j.first_at),
  lastAt: date(j.last_at),
  monthly: list(j.monthly, (m) => ({ month: str(m.month), totalAmount: num(m.total_amount) })),
  cadence: j.cadence == null ? null : cadence(j.cadence),
  typicalAmount: numOrNull(j.typical_amount),
  nextExpectedAt: dateOrNull(j.next_expected_at),
  memoryState: strOrNull(j.memory_state),
  categorySource: strOrNull(j.category_source),
});

export const mapAppUpdate = (j: Json): AppUpdateInfo => ({
  versionCode: num(j.version_code),
  versionName: str(j.version_name),
  releaseNotes: j.release_notes == null ? '' : str(j.release_notes),
  minSupportedVersionCode: numOrNull(j.min_supported_version_code),
  sha256: str(j.sha256),
  sizeBytes: num(j.size_bytes),
  downloadUrl: str(j.download_url),
});
