import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { userAvatarForSeed } from '../lib/avatars';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface AvatarChipProps {
  initials: string;
  size?: number;
  radius?: number;
  backgroundColor?: string;
  foregroundColor?: string;
  /** Overrides the flat background with a gradient (the user's own avatar). */
  gradient?: readonly [ColorValue, ColorValue, ...ColorValue[]];
}

/** Circular/squircle initials avatar. The user's own (gradient accent fill) and merchants' (flat tint/ink pair). */
export function AvatarChip({ initials, size = 40, radius, backgroundColor, foregroundColor, gradient }: AvatarChipProps) {
  const shape = { width: size, height: size, borderRadius: radius ?? size / 2 };
  const label = (
    <Text style={[typography.amountMedium14, { fontSize: size * 0.36, color: foregroundColor ?? colors.onInk }]}>{initials}</Text>
  );
  // `gradient` is accepted for compatibility; bencho keeps chips flat, so its first stop is the fill.
  const fill = backgroundColor ?? (gradient ? String(gradient[0]) : colors.ink);
  return <View style={[styles.center, shape, { backgroundColor: fill }]}>{label}</View>;
}

interface UserAvatarProps {
  /** The user's id; picks one of the bundled illustrations deterministically. */
  seed: string | null | undefined;
  initials: string;
  size?: number;
  /** Only used by the initials fallback. */
  gradient?: AvatarChipProps['gradient'];
  foregroundColor?: string;
  backgroundColor?: string;
}

/**
 * The signed-in user's avatar: one of the bundled illustrations, picked from
 * `seed` by userAvatarForSeed. Falls back to the initials chip when there is no
 * seed (signed out, or a user record that arrived without an id), or when the
 * image fails to load.
 */
export function UserAvatar({ seed, initials, size = 40, gradient, foregroundColor, backgroundColor }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const source = userAvatarForSeed(seed);
  if (!source || failed) {
    return <AvatarChip initials={initials} size={size} gradient={gradient} foregroundColor={foregroundColor} backgroundColor={backgroundColor} />;
  }
  return <Image source={source} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: colors.border }} resizeMode="cover" />;
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
