import { Platform } from 'react-native';

/**
 * The backends the app can point at. Selectable at runtime from Profile >
 * Developer settings, unlocked by tapping that row 5 times like Android's
 * Developer Options - available in every build, not just debug, so a tester on
 * a release build can point at a staging/local backend too. Each preset's
 * default can still be overridden at build time via EXPO_PUBLIC_* env vars.
 */
export type ApiEnvironment = 'production' | 'local' | 'custom';

export const API_ENVIRONMENTS: readonly ApiEnvironment[] = ['production', 'local', 'custom'];

export const apiEnvironmentLabel: Record<ApiEnvironment, string> = {
  production: 'Deployed',
  local: 'Localhost',
  custom: 'Custom',
};

export function parseApiEnvironment(value: string | null | undefined): ApiEnvironment {
  return value === 'local' || value === 'custom' ? value : 'production';
}

const PRODUCTION_BASE_URL = process.env.EXPO_PUBLIC_MIRAVELT_API_BASE_URL || 'https://miravelt.deploy.lokeshrc.me/';

// Android emulator can't resolve "localhost" to the host machine - 10.0.2.2 is
// its documented alias for that. iOS simulator reaches the host as localhost.
// Port 9850 matches docker-compose_local.yaml's published port for the full
// containerized stack; override via EXPO_PUBLIC_MIRAVELT_LOCAL_API_BASE_URL for
// a bare `uvicorn app:app --reload` on 8000, a real device on the LAN, or a
// different port.
const DEFAULT_LOCAL_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:9850/' : 'http://localhost:9850/';
const LOCAL_BASE_URL = process.env.EXPO_PUBLIC_MIRAVELT_LOCAL_API_BASE_URL || DEFAULT_LOCAL_BASE_URL;

/** Base URL of a *preset* environment. `custom` has none - see [resolveBaseUrl]. */
export function presetBaseUrl(environment: Exclude<ApiEnvironment, 'custom'>): string {
  return environment === 'production' ? PRODUCTION_BASE_URL : LOCAL_BASE_URL;
}

/**
 * The base URL every request actually targets: resolves `custom` against the
 * developer-entered URL (falling back to production if that's somehow blank,
 * which the Profile UI's own validation should never allow).
 */
export function resolveBaseUrl(environment: ApiEnvironment, customUrl: string): string {
  if (environment !== 'custom') return presetBaseUrl(environment);
  const custom = customUrl.trim();
  if (!custom) return presetBaseUrl('production');
  return custom.endsWith('/') ? custom : `${custom}/`;
}
