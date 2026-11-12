import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jobsRepository, statementsRepository } from '../api/instance';
import type { Insight, Job, Statement, StatementAnalytics } from '../domain/types';
import { queryClient } from '../lib/queryClient';
import { useAuth } from '../state/auth';
import { useSession } from '../state/session';

/**
 * A "period" is a Statement, per the design's "NEW MODEL" framing - one Google
 * Pay statement upload, switched from the header pill rather than browsed as a
 * file list.
 */

export const invalidatePeriods = () => queryClient.invalidateQueries({ queryKey: ['periods'] });

/** Keyed on the signed-in user, so a sign-in never serves the last account's periods. */
export function usePeriods() {
  const userId = useAuth((s) => s.user?.id ?? null);
  return useQuery({
    queryKey: ['periods', userId],
    enabled: userId != null,
    queryFn: async (): Promise<Statement[]> => (await statementsRepository.list({ page: 1, pageSize: 50, sortBy: 'uploaded_at', sortOrder: 'desc' })).items,
  });
}

/** The explicitly selected period, else the most recent COMPLETED one, else the newest. */
export function pickCurrentPeriod(periods: Statement[] | undefined, selectedId: string | null): Statement | null {
  if (!periods || periods.length === 0) return null;
  if (selectedId) {
    const selected = periods.find((p) => p.id === selectedId);
    if (selected) return selected;
  }
  return periods.find((p) => p.processingStatus === 'COMPLETED') ?? periods[0];
}

/**
 * The completed period that starts most recently before `current` - for real
 * "vs previous period" deltas. Ordered by the period's own dates, not upload
 * order (F10): backfilling last year after this year must not compare them
 * the wrong way round. Same rule as the backend's get_previous_completed.
 */
export function pickPreviousPeriod(periods: Statement[] | undefined, current: Statement | null): Statement | null {
  if (!periods || !current) return null;
  let best: Statement | null = null;
  for (const p of periods) {
    if (p.id === current.id || p.processingStatus !== 'COMPLETED') continue;
    if (p.periodStart.getTime() >= current.periodStart.getTime()) continue;
    if (!best || p.periodStart.getTime() > best.periodStart.getTime()) best = p;
  }
  return best;
}

/** Everything that shows a period's numbers - refetched after a correction recomputes them (F3). */
export function invalidatePeriodData(): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['periods'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['insights'] }),
    queryClient.invalidateQueries({ queryKey: ['activity'] }),
    queryClient.invalidateQueries({ queryKey: ['category'] }),
    queryClient.invalidateQueries({ queryKey: ['drilldown'] }),
    queryClient.invalidateQueries({ queryKey: ['patterns'] }),
    queryClient.invalidateQueries({ queryKey: ['people'] }),
    queryClient.invalidateQueries({ queryKey: ['teach'] }),
  ]);
}

export function useCurrentPeriod(): Statement | null {
  const periods = usePeriods().data;
  const selectedId = useSession((s) => s.selectedPeriodId);
  return useMemo(() => pickCurrentPeriod(periods, selectedId), [periods, selectedId]);
}

export function usePreviousPeriod(): Statement | null {
  const periods = usePeriods().data;
  const current = useCurrentPeriod();
  return useMemo(() => pickPreviousPeriod(periods, current), [periods, current]);
}

/** The most recent period still being processed, if any. */
export function useInProgressPeriod(): Statement | null {
  const periods = usePeriods().data;
  return useMemo(() => periods?.find((p) => p.processingStatus === 'PENDING' || p.processingStatus === 'PROCESSING') ?? null, [periods]);
}

// Keyed on the period's analytics revision as well: the backend bumps it on
// every recompute (a correction, an overlapping upload), so a cached or
// persisted copy of older numbers is never shown for a newer revision.
const analyticsQuery = (period: Statement | null) => ({
  queryKey: ['analytics', period?.id ?? null, period?.analyticsRevision ?? 0],
  enabled: period != null && period.processingStatus === 'COMPLETED',
  queryFn: (): Promise<StatementAnalytics> => statementsRepository.analytics(period!.id),
});

export function useCurrentPeriodAnalytics() {
  return useQuery(analyticsQuery(useCurrentPeriod()));
}

export function usePreviousPeriodAnalytics() {
  return useQuery(analyticsQuery(usePreviousPeriod()));
}

export function useCurrentPeriodInsights() {
  const period = useCurrentPeriod();
  return useQuery({
    queryKey: ['insights', period?.id ?? null, period?.analyticsRevision ?? 0],
    enabled: period != null && period.processingStatus === 'COMPLETED',
    queryFn: async (): Promise<Insight[]> => (await statementsRepository.insights(period!.id)).insights,
  });
}

/** A single job snapshot (not polled) - for the Period switcher's live row, which just needs one reading. */
export function useJobSnapshot(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ['job', jobId],
    enabled: !!jobId,
    staleTime: 0,
    gcTime: 0,
    queryFn: (): Promise<Job> => jobsRepository.get(jobId!),
  });
}

/**
 * Reports "this period's Overview was shown" once per statement id, for the
 * admin activation funnel's "time to insight" metric. Fire-and-forget: one
 * best-effort network call, never anything the UI needs to await.
 */
export function markPeriodViewedOnce(statementId: string): void {
  if (!useSession.getState().claimViewed(statementId)) return;
  statementsRepository.markViewed(statementId).catch(() => {});
}

/**
 * Live job progress, polled until the job finishes - shared by the Analysing
 * screen and Overview's "still analysing" placeholder. Stops polling when the
 * component unmounts.
 */
export function useJobPoll(jobId: string | null | undefined, onUpdate?: (job: Job, previous: Job | null) => void) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<Error | null>(null);
  // Held in a ref-like closure so a changing callback identity doesn't restart polling.
  const [callback] = useState(() => ({ current: onUpdate }));
  callback.current = onUpdate;

  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    let latest: Job | null = null;
    setJob(null);
    setError(null);
    jobsRepository
      .poll(jobId, {
        signal: controller.signal,
        onUpdate: (next) => {
          const previous = latest;
          latest = next;
          setJob(next);
          callback.current?.(next, previous);
        },
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => controller.abort();
  }, [jobId, callback]);

  return { job, error, loading: job == null && error == null };
}
