import * as LocalAuthentication from 'expo-local-authentication';

/**
 * App lock (PROJECT_AUDIT.md D4): fingerprint, face or the device PIN before
 * the app shows anything, expected of anything that displays money.
 *
 * This guards the screen, not the data: the session tokens already live in
 * the platform keystore (api/tokenStorage.ts). It stops someone holding an
 * unlocked phone from opening the app and reading it.
 */
export type LockAvailability = 'available' | 'not-enrolled' | 'unsupported';

export async function lockAvailability(): Promise<LockAvailability> {
  try {
    // SECRET (1) or above: a PIN, pattern or password also counts - the
    // prompt falls back to it, so biometrics are not required.
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level !== LocalAuthentication.SecurityLevel.NONE) return 'available';
    return (await LocalAuthentication.hasHardwareAsync()) ? 'not-enrolled' : 'unsupported';
  } catch {
    return 'unsupported';
  }
}

/** True when the person proved it is their phone. A cancelled or failed prompt is false, never an exception. */
export async function authenticate(reason = 'Unlock Miravelt'): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

/** How long the app may sit in the background before it locks again. */
export const RELOCK_AFTER_MS = 60_000;

export function shouldRelock(backgroundedAt: number | null, now: number = Date.now()): boolean {
  return backgroundedAt != null && now - backgroundedAt >= RELOCK_AFTER_MS;
}
