import { ApiHttpException, ApiNetworkException } from './errors';
import type { ApiClient } from './client';
import {
  mapAnomaly,
  mapAppUpdate,
  mapCategoryPattern,
  mapExplain,
  mapInsights,
  mapJob,
  mapMerchantPattern,
  mapMoM,
  mapPaged,
  mapStatement,
  mapStatementAnalytics,
  mapSubscriptions,
  mapTransaction,
  mapUploadResponse,
  mapUser,
} from './mappers';
import type { TokenStorage } from './tokenStorage';
import { toDateOnly } from '../lib/format';
import type {
  AnomalyCheckResult,
  AppUpdateInfo,
  CategoryPatternEntry,
  ExplainOutcome,
  Job,
  MerchantPatternEntry,
  MoMTrend,
  Paged,
  ProcessingStatus,
  Statement,
  StatementAnalytics,
  StatementInsights,
  StatementUploadResponse,
  SubscriptionsSummary,
  Transaction,
  TransactionType,
  User,
} from '../domain/types';

type Json = Record<string, unknown>;

export function createAuthRepository(api: ApiClient, tokens: TokenStorage) {
  const fetchCurrentUser = async (): Promise<User> => mapUser(await api.get<Json>('/users/me'));
  return {
    fetchCurrentUser,
    async register(email: string, password: string): Promise<User> {
      return mapUser(await api.post<Json>('/auth/register', { body: { email, password } }));
    },
    async login(email: string, password: string): Promise<User> {
      const data = await api.post<{ access_token: string; refresh_token: string }>('/auth/login', { body: { email, password } });
      await tokens.saveTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
      return fetchCurrentUser();
    },
    async logout(): Promise<void> {
      const refreshToken = await tokens.readRefreshToken();
      if (refreshToken) {
        try {
          await api.post('/auth/logout', { body: { refresh_token: refreshToken } });
        } catch {
          // Best-effort: logout is idempotent server-side and the client
          // session is cleared locally regardless of network state.
        }
      }
      await tokens.clear();
    },
    hasSession: () => tokens.hasSession(),
    async updateProfile(fullName: string | null): Promise<User> {
      return mapUser(await api.patch<Json>('/users/me', { body: { full_name: fullName } }));
    },
  };
}

export interface UploadParams {
  uri: string;
  filename: string;
  password?: string;
  /** Profile > "Keep original PDFs". Off: the backend keeps only the extracted transactions, never the file. */
  keepOriginalPdf?: boolean;
  onProgress?: (sent: number, total: number) => void;
  signal?: AbortSignal;
}

export interface TransactionQuery {
  page?: number;
  pageSize?: number;
  category?: string;
  transactionType?: TransactionType;
  merchant?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function createStatementsRepository(api: ApiClient) {
  return {
    async upload(p: UploadParams): Promise<StatementUploadResponse> {
      const fields: Record<string, string> = { keep_original_pdf: String(p.keepOriginalPdf ?? true) };
      if (p.password) fields.password = p.password;
      const data = await api.upload<Json>('/statements/upload', {
        file: { uri: p.uri, name: p.filename, type: 'application/pdf' },
        fields,
        onProgress: p.onProgress,
        signal: p.signal,
      });
      return mapUploadResponse(data);
    },

    async list(
      q: { page?: number; pageSize?: number; processingStatus?: ProcessingStatus; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {},
    ): Promise<Paged<Statement>> {
      const data = await api.get<Json>('/statements', {
        query: {
          page: q.page ?? 1,
          page_size: q.pageSize ?? 20,
          processing_status: q.processingStatus,
          sort_by: q.sortBy ?? 'uploaded_at',
          sort_order: q.sortOrder ?? 'desc',
        },
      });
      return mapPaged(data, mapStatement);
    },

    async get(id: string): Promise<Statement> {
      return mapStatement(await api.get<Json>(`/statements/${id}`));
    },

    async delete(id: string): Promise<void> {
      await api.delete(`/statements/${id}`);
    },

    async transactions(statementId: string, q: TransactionQuery = {}): Promise<Paged<Transaction>> {
      const data = await api.get<Json>(`/statements/${statementId}/transactions`, {
        query: {
          page: q.page ?? 1,
          page_size: q.pageSize ?? 20,
          category: q.category,
          transaction_type: q.transactionType,
          merchant: q.merchant,
          start_date: q.startDate ? toDateOnly(q.startDate) : undefined,
          end_date: q.endDate ? toDateOnly(q.endDate) : undefined,
          sort_by: q.sortBy ?? 'timestamp',
          sort_order: q.sortOrder ?? 'desc',
        },
      });
      return mapPaged(data, mapTransaction);
    },

    async analytics(id: string): Promise<StatementAnalytics> {
      return mapStatementAnalytics(await api.get<Json>(`/statements/${id}/analytics`));
    },

    async insights(id: string): Promise<StatementInsights> {
      return mapInsights(await api.get<Json>(`/statements/${id}/insights`));
    },

    /** Fire-and-forget: the backend's first_viewed_at is set only on the first call. */
    async markViewed(id: string): Promise<void> {
      await api.post(`/statements/${id}/viewed`);
    },
  };
}

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  maxConsecutiveNetworkErrors?: number;
  signal?: AbortSignal;
  onUpdate: (job: Job) => void;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });

export function createJobsRepository(api: ApiClient) {
  const get = async (jobId: string): Promise<Job> => mapJob(await api.get<Json>(`/jobs/${jobId}`));
  return {
    get,
    /**
     * Polls until the job reaches a terminal state (COMPLETED/FAILED), the
     * timeout elapses, or `signal` aborts. There's no push/webhook.
     *
     * A network-level failure (timeout, dropped connection) is retried up to
     * `maxConsecutiveNetworkErrors` times in a row before surfacing: the backend
     * processes statements in-process and can answer slowly while a job runs,
     * and one slow poll must not end an analysis screen that is otherwise fine.
     * HTTP errors (404, 401...) still surface immediately.
     */
    async poll(jobId: string, opts: PollOptions): Promise<void> {
      const interval = opts.intervalMs ?? 2000;
      const maxErrors = opts.maxConsecutiveNetworkErrors ?? 5;
      const deadline = opts.timeoutMs == null ? null : Date.now() + opts.timeoutMs;
      let networkErrors = 0;
      while (!opts.signal?.aborted) {
        let job: Job;
        try {
          job = await get(jobId);
          networkErrors = 0;
        } catch (e) {
          if (e instanceof ApiNetworkException && ++networkErrors <= maxErrors) {
            await sleep(interval, opts.signal);
            continue;
          }
          throw e;
        }
        if (opts.signal?.aborted) return;
        opts.onUpdate(job);
        if (job.status === 'COMPLETED' || job.status === 'FAILED') return;
        if (deadline != null && Date.now() > deadline) return;
        await sleep(interval, opts.signal);
      }
    },
  };
}

export function createFeedbackRepository(api: ApiClient) {
  return {
    /**
     * `feedback_recorded` is true only when `correctedCategory` actually differs
     * from `originalPrediction` (a real correction, not a confirmation).
     */
    async submit(p: { transactionId: string; originalPrediction: string; correctedCategory: string; confidence: number }): Promise<boolean> {
      const data = await api.post<Json>('/v1/feedback/', {
        body: {
          transaction_id: p.transactionId,
          original_prediction: p.originalPrediction,
          corrected_category: p.correctedCategory,
          confidence: p.confidence,
        },
      });
      return Boolean(data.feedback_recorded);
    },
  };
}

export function createExplainRepository(api: ApiClient) {
  return {
    /**
     * POST /v1/explain - grounded explanation of a single transaction from the
     * user's own merchant history. Rate-limited 20/min, so this is a deliberate
     * on-demand action, never an auto-fetch-on-open call.
     */
    async explain(transactionText: string, targetQuestion?: string): Promise<ExplainOutcome> {
      const data = await api.post<Json>('/v1/explain', {
        body: { transaction_text: transactionText, ...(targetQuestion ? { target_question: targetQuestion } : {}) },
      });
      return mapExplain(data);
    },
  };
}

export function createAnalyticsRepository(api: ApiClient) {
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Json[]) : []);
  return {
    async categoryPatterns(days = 30): Promise<CategoryPatternEntry[]> {
      return arr(await api.get('/v1/analytics/patterns/categories', { query: { days } })).map(mapCategoryPattern);
    },
    async merchantPatterns(limit = 5): Promise<MerchantPatternEntry[]> {
      return arr(await api.get('/v1/analytics/patterns/merchants', { query: { limit } })).map(mapMerchantPattern);
    },
    async subscriptions(): Promise<SubscriptionsSummary> {
      return mapSubscriptions(await api.get<Json>('/v1/analytics/subscriptions'));
    },
    async trendsMoM(): Promise<MoMTrend> {
      return mapMoM(await api.get<Json>('/v1/analytics/trends/mom'));
    },
    /** API-key only, not JWT/user-scoped - evaluated against the merchant's global behavioral profile. Query params, not a body. */
    async anomalyCheck(merchant: string, amount: number): Promise<AnomalyCheckResult> {
      return mapAnomaly(await api.post<Json>('/v1/analytics/anomaly/check', { query: { merchant, amount } }));
    },
  };
}

export function createAppUpdateRepository(api: ApiClient) {
  return {
    /** Null means "nothing published yet" (backend 404s) - the expected state before the first release. */
    async checkForUpdate(): Promise<AppUpdateInfo | null> {
      try {
        return mapAppUpdate(await api.get<Json>('/app/latest-version'));
      } catch (e) {
        if (e instanceof ApiHttpException && e.statusCode === 404) return null;
        throw e;
      }
    },
  };
}

export interface HealthProbeResult {
  reachable: boolean;
  /** The backend's own overall verdict ("healthy"/"degraded"), if it sent one. */
  status?: string;
  /** Per-dependency state, e.g. {mongodb: connected, milvus: connected, ...} - the whole stack in one glance. */
  services: Record<string, string>;
  error?: string;
}

/**
 * Hits `<baseUrl>/health` directly - deliberately not the app's ApiClient,
 * because the point is to check a URL *before* committing to it, and because
 * `/health` is unauthenticated, so a probe can't be confused by an auth failure.
 * Timeouts are short: an unreachable dev box should report back in seconds.
 */
export async function probeBackendHealth(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<HealthProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/health`, { signal: controller.signal });
    // A backend that is up but unhealthy answers 503 with the same body - a result worth showing.
    const body = (await response.json()) as Json;
    const services: Record<string, string> = {};
    if (body && typeof body.services === 'object' && body.services !== null) {
      for (const [k, v] of Object.entries(body.services as Json)) services[k] = String(v);
    }
    return { reachable: true, status: typeof body.status === 'string' ? body.status : undefined, services };
  } catch (e) {
    if (controller.signal.aborted) return { reachable: false, services: {}, error: 'Timed out. Nothing answered at this address.' };
    if (e instanceof SyntaxError) return { reachable: false, services: {}, error: 'Responded, but not with a backend health payload.' };
    return {
      reachable: false,
      services: {},
      error:
        'Could not connect. Check the host is running, the port is open in its firewall, and that this device is on the same network.',
    };
  } finally {
    clearTimeout(timer);
  }
}
