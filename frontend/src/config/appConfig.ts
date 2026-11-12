/**
 * Runtime config, supplied as EXPO_PUBLIC_* env vars at build time (see
 * frontend/README.md).
 *
 * The API base URL itself is NOT here - see apiEnvironment.ts, the single source
 * of truth for both backend targets (deployed vs. localhost), switchable at runtime.
 *
 * MIRAVELT_API_KEY has no client-facing issuance endpoint - it's a static value
 * the app ships with, the same way the backend operator holds it.
 */
/** What the key falls back to when none was set at build time - surfaced in Developer settings so a keyless build is obvious. */
export const PLACEHOLDER_API_KEY = 'miravelt_test_key_123'; // gitleaks:allow - public test placeholder, not a credential

export const appConfig = {
  apiKey: process.env.EXPO_PUBLIC_MIRAVELT_API_KEY || PLACEHOLDER_API_KEY,
  placeholderApiKey: PLACEHOLDER_API_KEY,
  /**
   * Pre-fills the login form with a seeded local test account so sign-in during
   * development is one tap. Debug-only: `__DEV__` is false in release builds.
   */
  // From a developer's own untracked .env.local, never from source: this
  // repository is public (SECURITY_AUDIT / Fable report V3).
  devEmail: process.env.EXPO_PUBLIC_MIRAVELT_DEV_EMAIL ?? '',
  devPassword: process.env.EXPO_PUBLIC_MIRAVELT_DEV_PASSWORD ?? '',
};
