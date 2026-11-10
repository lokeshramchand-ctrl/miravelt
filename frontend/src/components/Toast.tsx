import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast, type ToastTone } from '../state/toast';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { motion } from '../theme/tokens';
import { typography } from '../theme/typography';
import { Icon } from './Icon';
import { useReducedMotion } from './Live';
import { nativeDriver } from './motion';

/**
 * The app's toast (bencho `.toast`): a floating card with a status bar on its left edge; clears
 * itself. Motion from transitions.dev's toast: it rises in with a spring while scaling up from
 * .94 and fading in, and on its way out it sinks, shrinks and fades instead of vanishing. A new
 * toast replaces the current one with a fresh rise.
 */
export function ToastHost() {
  const { message, tone, nonce, hide } = useToast();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  // Keeps the last toast on screen while it animates out after `message` clears.
  const [shown, setShown] = useState<{ message: string; tone: ToastTone; nonce: number } | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, 3800);
    return () => clearTimeout(timer);
  }, [message, nonce, hide]);

  useEffect(() => {
    if (message) {
      setShown({ message, tone, nonce });
      t.setValue(0);
      const enter = reduced
        ? Animated.timing(t, { toValue: 1, duration: 120, useNativeDriver: nativeDriver })
        : Animated.spring(t, { toValue: 1, ...motion.spring, useNativeDriver: nativeDriver });
      enter.start();
      return () => enter.stop();
    }
    const exit = Animated.timing(t, { toValue: 0, duration: reduced ? 100 : 200, easing: Easing.in(Easing.quad), useNativeDriver: nativeDriver });
    exit.start(({ finished }) => finished && setShown(null));
    return () => exit.stop();
  }, [message, tone, nonce, t, reduced]);

  if (!shown) return null;
  const accent = shown.tone === 'error' ? colors.down : shown.tone === 'success' ? colors.up : colors.signal;
  const opacity = t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const transform = reduced
    ? []
    : [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }];
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 92 }]}>
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: colors.solid, borderColor: colors.border, opacity, transform },
          Platform.OS === 'web' ? ({ backdropFilter: 'blur(10px)' } as object) : null,
          shadows.liftHi(),
        ]}
      >
        <View style={[styles.bar, { backgroundColor: accent }]} />
        <Icon name={shown.tone === 'error' ? 'error-outline' : shown.tone === 'success' ? 'check-circle' : 'info-outline'} size={17} color={accent} style={{ marginLeft: 12 }} />
        <Text accessibilityLiveRegion="polite" style={[typography.body13, { color: colors.text, flexShrink: 1, marginLeft: 10, marginRight: 14 }]}>
          {shown.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 1, maxWidth: 480, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
});
