import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Server-driven push (PROJECT_AUDIT.md D1/F16). The backend worker sends
 * "your period is ready" through the Expo push service when a job finishes,
 * so it arrives even if the app was swiped away - which the old local
 * notification, fired by the Analysing screen's own poll loop, could not do.
 *
 * Getting a token needs a real device, notification permission, and an EAS
 * project id in the app config (extra.eas.projectId) with FCM credentials
 * uploaded to it. Without any of these this resolves to null and the app
 * keeps its local notification as the fallback.
 */
type Registrar = {
  register(token: string, platform: 'android' | 'ios' | null): Promise<void>;
  unregister(token: string): Promise<void>;
};

let registeredToken: string | null = null;

export function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId ?? null;
}

export async function getPushToken(): Promise<string | null> {
  try {
    const projectId = easProjectId();
    if (!projectId) return null;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

/** Registers this device with the backend. True when a server push can reach it. */
export async function registerForPush(registrar: Registrar): Promise<boolean> {
  const token = await getPushToken();
  if (!token) return false;
  try {
    await registrar.register(token, Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null);
    registeredToken = token;
    return true;
  } catch {
    return false;
  }
}

/** Before sign-out, so the next person to use the phone does not get this account's alerts. */
export async function unregisterFromPush(registrar: Registrar): Promise<void> {
  const token = registeredToken ?? (await getPushToken());
  registeredToken = null;
  if (!token) return;
  try {
    await registrar.unregister(token);
  } catch {
    // Best effort: the backend also drops a token Expo reports as unregistered.
  }
}

export function isRegisteredForPush(): boolean {
  return registeredToken != null;
}
