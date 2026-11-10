import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';
import { typography } from '../theme/typography';

interface PrimaryPillButtonProps {
  label: string;
  onPress?: () => void;
  expand?: boolean;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Full/auto-width filled pill CTA - accent bg, accent-ink text. */
export function PrimaryPillButton({ label, onPress, expand = true, loading = false, disabled = false, testID, style }: PrimaryPillButtonProps) {
  const inactive = loading || disabled || !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.primary,
        expand ? styles.expand : styles.auto,
        inactive && { opacity: 0.6 },
        pressed && !inactive && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={colors.accentInk} /> : <Text style={[typography.buttonLabel15, { color: colors.accentInk }]}>{label}</Text>}
    </Pressable>
  );
}

interface SecondaryPillButtonProps {
  label: string;
  onPress?: () => void;
  expand?: boolean;
  foreground: string;
  borderColor: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Outline pill - hairline border, transparent bg. */
export function SecondaryPillButton({ label, onPress, expand = true, foreground, borderColor, testID, style }: SecondaryPillButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, { borderColor }, expand ? styles.expand : styles.auto, pressed && { opacity: 0.7 }, style]}
    >
      <Text style={[typography.buttonLabel14, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

interface TextActionLinkProps {
  label: string;
  onPress: () => void;
  color?: string;
  testID?: string;
}

/** No-container text link, e.g. "See transaction", "All 5 →". */
export function TextActionLink({ label, onPress, color, testID }: TextActionLinkProps) {
  return (
    <Pressable accessibilityRole="link" testID={testID} onPress={onPress} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Text style={[typography.buttonLabel12, { color: color ?? colors.accentDim }]}>{label}</Text>
    </Pressable>
  );
}

/** Centers an auto-width button without stretching it. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'center' }}>{children}</View>;
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  secondary: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expand: { alignSelf: 'stretch' },
  auto: { alignSelf: 'center' },
});
