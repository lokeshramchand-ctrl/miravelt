import { create } from 'zustand';

export type ToastTone = 'default' | 'success' | 'error';

interface ToastState {
  message: string | null;
  tone: ToastTone;
  /** Bumped per toast so a repeat of the same message still re-shows. */
  nonce: number;
  show(message: string, tone?: ToastTone): void;
  hide(): void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: 'default',
  nonce: 0,
  show: (message, tone = 'default') => set((s) => ({ message, tone, nonce: s.nonce + 1 })),
  hide: () => set({ message: null }),
}));

export const showToast = (message: string, tone: ToastTone = 'default') => useToast.getState().show(message, tone);
