import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Thin wrapper around expo-notifications for the two local notifications this
 * app fires: "your statement finished processing" and "unusual spend", both
 * triggered from the Analysing screen's live job poll while the app process is
 * alive (foreground or backgrounded) - there is no push/server-triggered path.
 */
const JOB_CHANNEL = 'job_status';
const UNUSUAL_CHANNEL = 'unusual_spend';

let initialized = false;

export async function initNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(JOB_CHANNEL, {
      name: 'Statement processing',
      description: 'Notifies when a statement finishes analysing',
      importance: Notifications.AndroidImportance.HIGH,
    });
    // Own channel, so it neither replaces the "ready" notification nor shares
    // its on/off switch in system settings.
    await Notifications.setNotificationChannelAsync(UNUSUAL_CHANNEL, {
      name: 'Unusual spend',
      description: 'WATCH-level signals found in a newly analysed statement',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function showJobDone(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: 'job-done',
    content: { title, body },
    trigger: Platform.OS === 'android' ? { channelId: JOB_CHANNEL } : null,
  });
}

export async function showUnusualSpend(body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: 'unusual-spend',
    content: { title: 'Unusual spend in your statement', body },
    trigger: Platform.OS === 'android' ? { channelId: UNUSUAL_CHANNEL } : null,
  });
}
