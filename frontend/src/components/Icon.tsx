import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, withAlpha } from '../theme/colors';
import { ICON_PATHS } from './iconPaths';
import type { IconName } from './iconPaths';

export type { IconName };

/** One icon family for the whole app: Phosphor regular, inlined (see iconPaths.ts). */
export function Icon({ name, size = 18, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={ICON_PATHS[name]} fill={color ?? colors.text} />
    </Svg>
  );
}

type Tone = 'neutral' | 'signal' | 'up' | 'warn' | 'down' | 'ink';

/**
 * The icon chip - bencho's one container for every icon that sits in a box: `--surface-2`
 * with an inset hairline. Colour only when the chip reports a status.
 */
export function IconChip({ name, tone = 'neutral', size = 32, iconSize, tint, style }: { name: IconName; tone?: Tone; size?: number; iconSize?: number; tint?: string; style?: StyleProp<ViewStyle> }) {
  const { bg, fg, border } = chipTone(tone, tint);
  return (
    <View style={[{ width: size, height: size, borderRadius: size >= 40 ? 12 : 10, backgroundColor: bg, borderWidth: 1, borderColor: border, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon name={name} size={iconSize ?? Math.round(size * 0.5)} color={fg} />
    </View>
  );
}

export function chipTone(tone: Tone, tint?: string): { bg: string; fg: string; border: string } {
  if (tint) return { bg: withAlpha(tint, 0.12), fg: tint, border: withAlpha(tint, 0.16) };
  switch (tone) {
    case 'signal':
      return { bg: colors.signalSoft, fg: colors.signalText, border: 'transparent' };
    case 'up':
      return { bg: colors.upSoft, fg: colors.upInk, border: 'transparent' };
    case 'warn':
      return { bg: colors.warnSoft, fg: colors.warnInk, border: 'transparent' };
    case 'down':
      return { bg: colors.downSoft, fg: colors.downInk, border: 'transparent' };
    case 'ink':
      return { bg: colors.ink, fg: colors.onInk, border: colors.ink };
    default:
      return { bg: colors.surface2, fg: colors.text, border: colors.border };
  }
}
