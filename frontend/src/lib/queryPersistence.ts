import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import type { Query } from '@tanstack/react-query';

/**
 * Offline-first reading (PROJECT_AUDIT.md D2): the query cache is written to
 * device storage, so a processed period opens instantly and works with no
 * signal. Processed periods change only when the user corrects something,
 * and a correction invalidates the affected queries.
 *
 * What is persisted is what the screens already hold in memory: the user's
 * own periods, analytics and transactions. It is cleared on sign-out and
 * account deletion (state/auth.ts) and expires after `MAX_AGE_MS`.
 */
export const PERSIST_KEY = 'miravelt.query_cache';
export const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Bump to discard every persisted cache after a change to a cached shape. */
const BUSTER = 'v2';

// Live or one-shot data that must never be served from disk.
const NEVER_PERSIST = new Set(['job', 'app-update', 'health', 'explain']);

// Dates come back from JSON as strings; the screens call .getTime() on them.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO_DATE.test(value) ? new Date(value) : value;
}

export function shouldPersistQuery(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  return query.state.status === 'success' && !NEVER_PERSIST.has(String(query.queryKey[0]));
}

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createAsyncStoragePersister({
    storage: AsyncStorage,
    key: PERSIST_KEY,
    throttleTime: 2000,
    deserialize: (cached) => JSON.parse(cached, reviveDates),
  }),
  maxAge: MAX_AGE_MS,
  buster: BUSTER,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
};

export function clearPersistedQueries(): Promise<void> {
  return AsyncStorage.removeItem(PERSIST_KEY).catch(() => {});
}
