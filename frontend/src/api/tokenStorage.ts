import * as SecureStore from 'expo-secure-store';

/**
 * Persists JWT access/refresh tokens in the platform keystore. Never persists
 * the X-Miravelt-API-Key (a build-time constant, see appConfig) - only per-user
 * session tokens live here.
 */
const ACCESS_KEY = 'miravelt.access_token';
const REFRESH_KEY = 'miravelt.refresh_token';

export interface TokenStorage {
  saveTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void>;
  readAccessToken(): Promise<string | null>;
  readRefreshToken(): Promise<string | null>;
  clear(): Promise<void>;
  hasSession(): Promise<boolean>;
}

export const tokenStorage: TokenStorage = {
  async saveTokens({ accessToken, refreshToken }) {
    await Promise.all([SecureStore.setItemAsync(ACCESS_KEY, accessToken), SecureStore.setItemAsync(REFRESH_KEY, refreshToken)]);
  },
  readAccessToken: () => SecureStore.getItemAsync(ACCESS_KEY),
  readRefreshToken: () => SecureStore.getItemAsync(REFRESH_KEY),
  async clear() {
    await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
  },
  async hasSession() {
    return (await SecureStore.getItemAsync(REFRESH_KEY)) != null;
  },
};
