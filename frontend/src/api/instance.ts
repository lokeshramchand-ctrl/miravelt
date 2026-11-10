import { ApiClient } from './client';
import {
  createAnalyticsRepository,
  createAppUpdateRepository,
  createAuthRepository,
  createExplainRepository,
  createFeedbackRepository,
  createJobsRepository,
  createStatementsRepository,
} from './repositories';
import { tokenStorage } from './tokenStorage';
import { effectiveApiBaseUrl } from '../state/settings';

type SessionExpiredListener = () => void;
const listeners = new Set<SessionExpiredListener>();

/** Subscribe to forced logouts (refresh-token reuse / expiry) so the UI can drop back to login. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The one ApiClient. It reads the base URL from the settings store on every
 * request, so switching backends (Profile > Developer settings) takes effect
 * app-wide without rebuilding anything.
 */
export const api = new ApiClient({
  getBaseUrl: () => effectiveApiBaseUrl(),
  tokenStorage,
  onSessionExpired: () => listeners.forEach((l) => l()),
});

export const authRepository = createAuthRepository(api, tokenStorage);
export const statementsRepository = createStatementsRepository(api);
export const jobsRepository = createJobsRepository(api);
export const feedbackRepository = createFeedbackRepository(api);
export const explainRepository = createExplainRepository(api);
export const analyticsRepository = createAnalyticsRepository(api);
export const appUpdateRepository = createAppUpdateRepository(api);
