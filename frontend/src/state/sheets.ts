import { create } from 'zustand';

interface SheetsState {
  periodSwitcherOpen: boolean;
  openPeriodSwitcher(): void;
  closePeriodSwitcher(): void;
}

/** Visibility of the app-wide sheets that several screens can open (they are hosted once at the root). */
export const useSheets = create<SheetsState>((set) => ({
  periodSwitcherOpen: false,
  openPeriodSwitcher: () => set({ periodSwitcherOpen: true }),
  closePeriodSwitcher: () => set({ periodSwitcherOpen: false }),
}));
