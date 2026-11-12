// Domain models. Wire JSON is snake_case; the repositories camelCase it and
// turn timestamp strings into Dates (see api/mappers.ts).

export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type TransactionType = 'DEBIT' | 'CREDIT';
export type TransactionStatus = 'SUCCESS' | 'FAILED' | 'PENDING';
export type InsightSeverity = 'INFO' | 'POSITIVE' | 'WARNING';

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  createdAt: Date;
  /** The address was confirmed with an emailed code (or by a password reset). */
  emailVerified: boolean;
}

/** Up to 2 uppercase initials from the name, falling back to the first letter of the email. */
export function userInitials(user: Pick<User, 'fullName' | 'email'>): string {
  const name = user.fullName?.trim();
  if (!name) return user.email.slice(0, 1).toUpperCase();
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export interface Statement {
  id: string;
  originalFilename: string;
  fileSizeBytes: number;
  pageCount: number | null;
  periodStart: Date;
  periodEnd: Date;
  declaredSentAmount: number | null;
  declaredReceivedAmount: number | null;
  computedSentAmount: number | null;
  computedReceivedAmount: number | null;
  reconciliationOk: boolean | null;
  transactionCount: number;
  processingStatus: ProcessingStatus;
  currentJobId: string | null;
  errorMessage: string | null;
  analyticsVersion: string;
  uploadedAt: Date;
  processingCompletedAt: Date | null;
  processingDurationMs: number | null;
  /** Record lines the parser could not read (PROJECT_AUDIT.md A6); null for older statements. */
  unparsedCount: number | null;
  /** Bumped whenever the backend recomputes this period's analytics (a correction, an overlapping upload). */
  analyticsRevision: number;
  /** A generated demo period ("Try with sample data"), not the user's own money. */
  isSample: boolean;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface StatementUploadResponse {
  statementId: string;
  jobId: string;
  status: ProcessingStatus;
}

export interface Transaction {
  id: string;
  statementId: string | null;
  timestamp: Date;
  merchant: string | null;
  category: string | null;
  amount: number;
  transactionType: TransactionType;
  status: TransactionStatus;
  counterpartyRaw: string | null;
  referenceNumber: string | null;
  bank: string | null;
  accountLast4: string | null;
  paymentMethod: string;
  /**
   * How the category was decided: >= 0.9 known merchant or the user's own
   * correction, (0, 0.9) a best guess from the payee's name, 0 no match; null
   * for incoming money and older rows.
   */
  categorizationConfidence: number | null;
  /**
   * Where the category came from: 'user' (your correction), 'user_memory'
   * (your earlier correction for this payee), 'alias', 'community', 'keyword',
   * 'none', 'income'. Null on older rows.
   */
  categorizationSource: string | null;
  /** 'person' or 'business' (backend engines/counterparty.py). */
  counterpartyKind: 'person' | 'business' | null;
  note: string | null;
  tags: string[];
}

export interface Job {
  id: string;
  jobType: string;
  resourceType: string;
  resourceId: string;
  status: JobStatus;
  stage: string | null;
  progressPercent: number;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface Insight {
  type: string;
  message: string;
  severity: InsightSeverity;
  /** 'computed' (arithmetic on stored rows) or 'llm' (generated, admitted only after the backend fact-check). */
  origin: 'computed' | 'llm';
}

export interface StatementInsights {
  statementId: string;
  insights: Insight[];
}

export interface CategoryBreakdownEntry {
  category: string;
  totalAmount: number;
  count: number;
}
export interface TopMerchantEntry {
  merchant: string;
  totalAmount: number;
  count: number;
}
export interface DailyTrendEntry {
  date: Date;
  totalAmount: number;
  count: number;
}
export type Cadence = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringPaymentEntry {
  merchant: string;
  /** Monthly equivalent of the typical amount at its cadence. */
  estimatedMonthlyCost: number;
  /** Share of payment gaps on cadence, 0..1. */
  periodicityScore: number;
  occurrences: number;
  cadence: Cadence;
  cadenceDays: number;
  /** Median of the most recent payments - what one charge costs. */
  typicalAmount: number;
  lastAmount: number;
  lastPaidAt: Date | null;
  nextExpectedAt: Date | null;
  /** Latest charge against the typical one before it, as a fraction; null without a baseline. */
  amountChange: number | null;
  /** Monthly equivalent over the period's average monthly spend. */
  shareOfMonthlySpend: number | null;
}

export interface StatementAnalytics {
  statementId: string;
  totalSpend: number;
  totalIncome: number;
  net: number;
  averageTransactionValue: number;
  transactionCount: number;
  failedTransactionCount: number;
  categoryBreakdown: CategoryBreakdownEntry[];
  topMerchants: TopMerchantEntry[];
  dailyTrend: DailyTrendEntry[];
  recurringPayments: RecurringPaymentEntry[];
  /** Total spend over the months the period covers. */
  averageMonthlySpend: number;
  generatedAt: Date;
}

/**
 * `categoryBreakdown` minus `Income`: the backend's breakdown covers every
 * transaction, credits included, while `totalSpend` is debits only - so any
 * "where it went" / "% of spending" view must leave the incoming money out or
 * its shares pass 100%.
 */
export function spendingBreakdown(analytics: Pick<StatementAnalytics, 'categoryBreakdown'>): CategoryBreakdownEntry[] {
  return analytics.categoryBreakdown.filter((e) => e.category !== 'Income');
}

// /v1/analytics/* endpoints have no response_model on the backend, so shapes
// are reverse-engineered and every field is deliberately defaulted.
export interface CategoryPatternEntry {
  category: string;
  totalAmount: number;
  count: number;
}
export interface MerchantPatternEntry {
  merchant: string | null;
  visits: number;
  spent: number;
}
export interface SubscriptionDetail {
  merchant: string;
  estimatedMonthlyCost: number;
  periodicityScore: number;
  lastBilled: Date | null;
  cadence: Cadence;
  typicalAmount: number;
  nextExpectedAt: Date | null;
}
export interface SubscriptionsSummary {
  activeSubscriptions: number;
  totalMonthlyBurn: number;
  details: SubscriptionDetail[];
}
export interface MoMTrend {
  currentSpend: number;
  previousSpend: number;
  momGrowthPercentage: number;
  trend: string;
}
export interface AnomalyCheckResult {
  isAnomaly: boolean;
  reason: string;
  confidence: number | null;
}

/**
 * POST /v1/explain always answers 200, but `result` has two incompatible shapes
 * depending on whether grounded context was found, so this models that union.
 */
export type ExplainOutcome =
  | {
      available: true;
      explanation: string;
      confidence: string | null;
      primarySource: string | null;
      /** Sentences computed from the user's own history - always true, with or without the model. */
      facts: string[];
      /** True when the model phrased the answer (and it passed the backend fact check); false when `explanation` is the computed facts. */
      generated: boolean;
    }
  | { available: false; unavailableReason: string };

/** One card of the "Teach Miravelt" deck: an uncategorised payee and what it accounts for. */
export interface TeachCard {
  merchant: string;
  totalAmount: number;
  count: number;
  payeeNames: string[];
  counterpartyKind: 'person' | 'business' | null;
  lastPaidAt: Date | null;
  /** Share of all uncategorised spend this payee explains, 0..1. */
  shareOfUnknown: number;
  /** A hint from similar names the user (or the curated list) already has a category for. */
  suggestedCategory: string | null;
  similarNames: string[];
}

export interface TeachDeck {
  unknownTotal: number;
  unknownPayees: number;
  coveredTotal: number;
  coveredShare: number;
  cards: TeachCard[];
}

export interface TeachAnswer {
  merchant: string;
  category?: string;
  kind?: 'person' | 'business';
}

/** A person you exchanged money with. `net` > 0: they paid you more than you paid them. */
export interface PersonLedgerRow {
  payeeKey: string;
  name: string;
  sent: number;
  received: number;
  net: number;
  count: number;
  firstAt: Date;
  lastAt: Date;
}

export interface MerchantPage {
  merchant: string;
  category: string | null;
  counterpartyKind: 'person' | 'business' | null;
  payeeNames: string[];
  totalSpent: number;
  totalReceived: number;
  paymentCount: number;
  averagePayment: number;
  firstAt: Date;
  lastAt: Date;
  monthly: { month: string; totalAmount: number }[];
  cadence: Cadence | null;
  typicalAmount: number | null;
  nextExpectedAt: Date | null;
  /** EPHEMERAL / TEMPORARY / PERMANENT: how settled Miravelt's memory of this payee is. */
  memoryState: string | null;
  /** 'user' when the category came from the user's own correction. */
  categorySource: string | null;
}

export interface AppUpdateInfo {
  versionCode: number;
  versionName: string;
  releaseNotes: string;
  minSupportedVersionCode: number | null;
  sha256: string;
  sizeBytes: number;
  downloadUrl: string;
}
