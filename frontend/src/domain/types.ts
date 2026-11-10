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
export interface RecurringPaymentEntry {
  merchant: string;
  estimatedMonthlyCost: number;
  periodicityScore: number;
  occurrences: number;
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
  | { available: true; explanation: string; confidence: string | null; primarySource: string | null }
  | { available: false; unavailableReason: string };

export interface AppUpdateInfo {
  versionCode: number;
  versionName: string;
  releaseNotes: string;
  minSupportedVersionCode: number | null;
  sha256: string;
  sizeBytes: number;
  downloadUrl: string;
}
