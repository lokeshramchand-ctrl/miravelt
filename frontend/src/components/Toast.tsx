import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../state/toast';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { FadeInUp } from './motion';

const TONE_BG = { default: colors.onLight, success: colors.ink700, error: colors.rose } as const;

/** The app's snackbar: a floating pill near the bottom that clears itself after a few seconds. */
export function ToastHost() {
  const { message, tone, nonce, hide } = useToast();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 3800);
    return () => clearTimeout(t);
  }, [message, nonce, hide]);
  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 24 }]}>
      <FadeInUp key={nonce} duration={180} distance={10} style={[styles.toast, { backgroundColor: TONE_BG[tone] }]}>
        <Text accessibilityLiveRegion="polite" style={[typography.body13, { color: tone === 'default' ? colors.paper : colors.onDark }]}>
          {message}
        </Text>
      </FadeInUp>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.field, maxWidth: 480 },
});
