import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../state/toast';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { typography } from '../theme/typography';
import { Icon } from './Icon';
import { FadeInUp } from './motion';

/** The app's toast (bencho `.toast`): a floating glass card with a status bar on its left edge; clears itself. */
export function ToastHost() {
  const { message, tone, nonce, hide } = useToast();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 3800);
    return () => clearTimeout(t);
  }, [message, nonce, hide]);
  if (!message) return null;
  const accent = tone === 'error' ? colors.down : tone === 'success' ? colors.up : colors.signal;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 92 }]}>
      <FadeInUp key={nonce} duration={260} distance={12} style={[styles.toast, { backgroundColor: colors.solid, borderColor: colors.border }, Platform.OS === 'web' ? ({ backdropFilter: 'blur(10px)' } as object) : null, shadows.liftHi()]}>
        <View style={[styles.bar, { backgroundColor: accent }]} />
        <Icon name={tone === 'error' ? 'error-outline' : tone === 'success' ? 'check-circle' : 'info-outline'} size={17} color={accent} style={{ marginLeft: 12 }} />
        <Text accessibilityLiveRegion="polite" style={[typography.body13, { color: colors.text, flexShrink: 1, marginLeft: 10, marginRight: 14 }]}>
          {message}
        </Text>
      </FadeInUp>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 1, maxWidth: 480, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
});
