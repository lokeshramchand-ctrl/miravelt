import { create } from 'zustand';

interface SessionState {
  /**
   * Explicit user selection from the Period switcher sheet. Null means "use the
   * default" (most recent COMPLETED period) - see useCurrentPeriod.
   */
  selectedPeriodId: string | null;
  /** Statement ids already reported as viewed this session. */
  viewedPeriodIds: ReadonlySet<string>;
  selectPeriod(id: string | null): void;
  /** Returns true the first time an id is seen (the caller should then report the view). */
  claimViewed(id: string): boolean;
  reset(): void;
}

export const useSession = create<SessionState>((set, get) => ({
  selectedPeriodId: null,
  viewedPeriodIds: new Set(),
  selectPeriod: (id) => set({ selectedPeriodId: id }),
  claimViewed(id) {
    if (get().viewedPeriodIds.has(id)) return false;
    set({ viewedPeriodIds: new Set([...get().viewedPeriodIds, id]) });
    return true;
  },
  reset: () => set({ selectedPeriodId: null, viewedPeriodIds: new Set() }),
}));
