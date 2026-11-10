import { QueryClient } from '@tanstack/react-query';

/**
 * Data is cached until something invalidates it (an upload finishing, pull to
 * refresh, a retry), not refetched on every mount - the same lifetime the
 * Flutter providers had. No automatic retries: a failed load shows an
 * ErrorRetry the user can act on.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } },
});
