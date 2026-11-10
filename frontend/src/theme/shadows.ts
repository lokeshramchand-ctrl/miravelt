import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

/**
 * Elevation is expressed as explicit shadow styles, because the design's dark
 * surfaces use hairlines only - never shadows - while light surfaces use soft,
 * wide-spread card shadows. React Native has no spread radius, so the large
 * negative-spread shadows are approximated with a lower opacity.
 */
const shadow = (opacity: number, offsetY: number, radius: number, elevation: number): ViewStyle =>
  Platform.select<ViewStyle>({
    android: { elevation },
    default: { shadowColor: '#000', shadowOpacity: opacity, shadowOffset: { width: 0, height: offsetY }, shadowRadius: radius },
  }) ?? {};

export const shadows = {
  flat: shadow(0.05, 1, 2, 1),
  card: shadow(0.1, 10, 22, 3),
  sheetLight: shadow(0.2, -14, 40, 12),
  floatingNav: shadow(0.35, 14, 28, 14),
  none: {} as ViewStyle,
} as const;
