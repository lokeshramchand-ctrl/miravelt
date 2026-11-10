import { create } from 'zustand';
import { authRepository, onSessionExpired } from '../api/instance';
import { ApiException } from '../api/errors';
import type { User } from '../domain/types';
import { queryClient } from '../lib/queryClient';
import { useSession } from './session';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  /** `loading` only during the cold-start session check; a sign-in in flight is `busy`, not `loading`. */
  status: AuthStatus;
  user: User | null;
  /** A login/register request is in flight. */
  busy: boolean;
  bootstrap(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  registerAndLogin(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
  /** Replaces the cached user (after a profile edit). */
  setUser(user: User): void;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiException ? error.message : 'Something went wrong. Please try again.';
}

function clearUserScopedState() {
  useSession.getState().reset();
  queryClient.clear();
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  busy: false,

  async bootstrap() {
    if (!(await authRepository.hasSession())) {
      set({ status: 'unauthenticated', user: null });
      return;
    }
    try {
      set({ status: 'authenticated', user: await authRepository.fetchCurrentUser() });
    } catch {
      set({ status: 'unauthenticated', user: null });
    }
  },

  async login(email, password) {
    set({ busy: true });
    try {
      const user = await authRepository.login(email, password);
      set({ status: 'authenticated', user });
    } finally {
      set({ busy: false });
    }
  },

  async registerAndLogin(email, password) {
    set({ busy: true });
    try {
      await authRepository.register(email, password);
      const user = await authRepository.login(email, password);
      set({ status: 'authenticated', user });
    } finally {
      set({ busy: false });
    }
  },

  async logout() {
    await authRepository.logout();
    clearUserScopedState();
    set({ status: 'unauthenticated', user: null });
  },

  async refreshUser() {
    if (get().status !== 'authenticated') return;
    try {
      set({ user: await authRepository.fetchCurrentUser() });
    } catch {
      // Keep the cached user on a transient refresh failure.
    }
  },

  setUser(user) {
    set({ user });
  },
}));

// A forced logout from the API layer (refresh-token reuse/expiry): drop straight
// to unauthenticated rather than re-hitting a backend that will just 401 again.
onSessionExpired(() => {
  clearUserScopedState();
  useAuth.setState({ status: 'unauthenticated', user: null });
});
