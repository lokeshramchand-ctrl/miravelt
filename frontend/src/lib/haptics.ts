import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * One place for tactile feedback, so every interaction uses the same vocabulary:
 * `select` for moving a selection (tabs, chips, arc, chart bars), `tap` for pressing a button,
 * `toggle` for switches, `success`/`warning`/`error` for outcomes. No-ops on web, and never
 * throws - a device without a haptic engine simply stays quiet.
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';
const safe = (p: () => Promise<void>) => {
  if (!enabled) return;
  try {
    void p().catch(() => undefined);
  } catch {
    // ignore
  }
};

export const haptics = {
  select: () => safe(() => Haptics.selectionAsync()),
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  toggle: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  thud: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
