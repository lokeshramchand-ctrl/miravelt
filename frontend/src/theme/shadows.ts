import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';
import { colors } from './colors';

/**
 * bencho's two elevations: `lift` (a 1-2px hairline shadow every card gets) and `liftHi`
 * (a soft 30px drop for floating things - the nav, sheets, toasts). React Native has no
 * spread radius or second shadow, so these approximate the CSS. Functions, so they pick up
 * the current theme's shadow colour.
 */
const make = (opacity: number, offsetY: number, radius: number, elevation: number): ViewStyle =>
  Platform.select<ViewStyle>({
    android: { elevation, shadowColor: colors.shadow },
    web: { boxShadow: `0 ${offsetY}px ${radius}px -${Math.round(radius / 3)}px rgba(60, 72, 88, ${opacity})` } as ViewStyle,
    default: { shadowColor: colors.shadow, shadowOpacity: opacity, shadowOffset: { width: 0, height: offsetY }, shadowRadius: radius / 2 },
  }) ?? {};

export const shadows = {
  lift: () => make(colors.scheme === 'dark' ? 0.4 : 0.08, 8, 24, 1),
  liftHi: () => make(colors.scheme === 'dark' ? 0.7 : 0.22, 16, 40, 10),
  none: {} as ViewStyle,
} as const;
