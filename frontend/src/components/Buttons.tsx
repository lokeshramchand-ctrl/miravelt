import { ActivityIndicator, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { PressableScale } from './motion';

interface PrimaryPillButtonProps {
  label: string;
  onPress?: () => void;
  expand?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** The primary action: a solid ink pill (bencho `.btn-primary`). */
export function PrimaryPillButton({ label, onPress, expand = true, loading = false, disabled = false, icon, testID, style }: PrimaryPillButtonProps) {
  const inactive = loading || disabled || !onPress;
  return (
    <PressableScale
      haptic="tap"
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={label}
      testID={testID}
      disabled={inactive}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        base,
        { backgroundColor: colors.ink, minHeight: 50 },
        expand ? { alignSelf: 'stretch' } : { alignSelf: 'center', paddingHorizontal: 22 },
        inactive && !loading && { opacity: 0.45 },
        pressed && { opacity: 0.88 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.onInk} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {icon ? <Icon name={icon} size={17} color={colors.onInk} style={{ marginRight: 8 }} /> : null}
          <Text style={[typography.buttonLabel15, { color: colors.onInk }]}>{label}</Text>
        </View>
      )}
    </PressableScale>
  );
}

interface SecondaryPillButtonProps {
  label: string;
  onPress?: () => void;
  expand?: boolean;
  foreground?: string;
  borderColor?: string;
  icon?: IconName;
  tone?: 'default' | 'danger';
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Outline pill on a surface fill (bencho `.btn`); `tone="danger"` for destructive actions. */
export function SecondaryPillButton({ label, onPress, expand = true, foreground, borderColor, icon, tone = 'default', testID, style }: SecondaryPillButtonProps) {
  const fg = foreground ?? (tone === 'danger' ? colors.down : colors.text);
  return (
    <PressableScale
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        base,
        { minHeight: 46, backgroundColor: pressed ? colors.surface2 : colors.surface, borderWidth: 1, borderColor: borderColor ?? (tone === 'danger' ? colors.downSoft : colors.border2) },
        expand ? { alignSelf: 'stretch' } : { alignSelf: 'center', paddingHorizontal: 18 },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {icon ? <Icon name={icon} size={16} color={fg} style={{ marginRight: 8 }} /> : null}
        <Text style={[typography.buttonLabel14, { color: fg }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

interface TextActionLinkProps {
  label: string;
  onPress: () => void;
  color?: string;
  icon?: IconName;
  testID?: string;
}

/** No-container text link in the signal colour, e.g. "See all", with an optional trailing arrow. */
export function TextActionLink({ label, onPress, color, icon, testID }: TextActionLinkProps) {
  const fg = color ?? colors.signalText;
  return (
    <PressableScale haptic="tap" accessibilityRole="link" accessibilityLabel={label} testID={testID} onPress={onPress} hitSlop={10} scaleTo={0.94} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={[typography.buttonLabel13, { color: fg, fontFamily: 'Inter_600SemiBold' }]}>{label}</Text>
      {icon ? <Icon name={icon} size={14} color={fg} style={{ marginLeft: 4 }} /> : null}
    </PressableScale>
  );
}

/** Round icon button (bencho `.icon-btn.bordered`). */
export function IconButton({ icon, onPress, label, size = 42, badge }: { icon: IconName; onPress?: () => void; label: string; size?: number; badge?: boolean }) {
  return (
    <PressableScale
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.9}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.surface2 : colors.surface, borderWidth: 1, borderColor: colors.border })}
    >
      <Icon name={icon} size={18} color={colors.text} />
      {badge ? <View style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: '#ff5a6e', borderWidth: 1.5, borderColor: '#ffffff' }} /> : null}
    </PressableScale>
  );
}

/** Centers an auto-width button without stretching it. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'center' }}>{children}</View>;
}

const base: ViewStyle = { borderRadius: radius.pill, paddingVertical: 13, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' };
