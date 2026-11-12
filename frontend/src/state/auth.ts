import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { authRepository, onSessionExpired } from '../api/instance';
import { ApiException, ApiSessionExpiredException } from '../api/errors';
import type { User } from '../domain/types';
import { queryClient } from '../lib/queryClient';
import { clearPersistedQueries } from '../lib/queryPersistence';
import { unregisterFromPush } from '../lib/push';
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
  /** Permanently deletes the account and all its data, then drops to signed out. */
  deleteAccount(password: string): Promise<void>;
  refreshUser(): Promise<void>;
  /** Replaces the cached user (after a profile edit). */
  setUser(user: User): void;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiException ? error.message : 'Something went wrong. Please try again.';
}

const CACHED_USER_KEY = 'miravelt.cached_user';

/** The last signed-in user, so an offline cold start can still show the app (F13). */
async function readCachedUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Omit<User, 'createdAt'> & { createdAt: string };
    return { ...parsed, createdAt: new Date(parsed.createdAt) };
  } catch {
    return null;
  }
}

function cacheUser(user: User | null): void {
  (user ? AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user)) : AsyncStorage.removeItem(CACHED_USER_KEY)).catch(() => {});
}

/** Only a rejected session ends one. Offline, a timeout or a 5xx is not a reason to sign out. */
export function isSessionRejection(e: unknown): boolean {
  return e instanceof ApiSessionExpiredException || (e instanceof ApiException && e.statusCode === 401);
}

function clearUserScopedState() {
  useSession.getState().reset();
  queryClient.clear();
  // The on-disk copy too: the next account on this phone must never be
  // served the last one's periods.
  void clearPersistedQueries();
  cacheUser(null);
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
      const user = await authRepository.fetchCurrentUser();
      cacheUser(user);
      set({ status: 'authenticated', user });
    } catch (e) {
      if (isSessionRejection(e)) {
        clearUserScopedState();
        set({ status: 'unauthenticated', user: null });
        return;
      }
      // Tokens are stored and nothing said they are invalid: we are just
      // offline. Open the app on the cached user and cached data.
      set({ status: 'authenticated', user: await readCachedUser() });
    }
  },

  async login(email, password) {
    set({ busy: true });
    try {
      const user = await authRepository.login(email, password);
      cacheUser(user);
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
      cacheUser(user);
      set({ status: 'authenticated', user });
    } finally {
      set({ busy: false });
    }
  },

  async logout() {
    // While the session is still valid: stop this device receiving the account's alerts.
    await unregisterFromPush({ register: authRepository.registerPushToken, unregister: authRepository.unregisterPushToken });
    await authRepository.logout();
    clearUserScopedState();
    set({ status: 'unauthenticated', user: null });
  },

  async deleteAccount(password) {
    // Throws on a wrong password or a network failure - nothing is cleared then.
    await authRepository.deleteAccount(password);
    clearUserScopedState();
    set({ status: 'unauthenticated', user: null });
  },

  async refreshUser() {
    if (get().status !== 'authenticated') return;
    try {
      const user = await authRepository.fetchCurrentUser();
      cacheUser(user);
      set({ user });
    } catch {
      // Keep the cached user on a transient refresh failure.
    }
  },

  setUser(user) {
    cacheUser(user);
    set({ user });
  },
}));

// A forced logout from the API layer (refresh-token reuse/expiry): drop straight
// to unauthenticated rather than re-hitting a backend that will just 401 again.
onSessionExpired(() => {
  clearUserScopedState();
  useAuth.setState({ status: 'unauthenticated', user: null });
});
