import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Keyboard, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { motion, radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { Icon } from './Icon';
import { easeOutSoft, nativeDriver, PressableScale } from './motion';
import { haptics } from '../lib/haptics';

interface MiraveltSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional docs-style head (the dashboard's `Sheet`): eyebrow, title, sub line and a close button. */
  eyebrow?: string;
  title?: string;
  sub?: string;
  /** Kept for call-site compatibility; every surface now shares one palette. */
  dark?: boolean;
  /** Set false to block dismissal by tapping outside / back (e.g. mid-upload). */
  dismissible?: boolean;
}

/**
 * A modal bottom sheet (the dashboard's Sheet on phone widths): rounded top, drag handle,
 * blurred scrim, and a springy rise. Declarative (`visible`) rather than show-and-await.
 */
export function MiraveltSheet({ visible, onClose, children, eyebrow, title, sub, dismissible = true }: MiraveltSheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [keyboard, setKeyboard] = useState(0);
  const drag = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Drag the handle/head down to dismiss: follows the finger, resists upward pulls, and springs
  // back unless pulled far or flicked.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => dismissible && g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(g.dy > 0 ? g.dy : g.dy / 6),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 1.1) {
          haptics.tap();
          closeRef.current();
          Animated.timing(drag, { toValue: 0, duration: 260, useNativeDriver: nativeDriver }).start();
        } else {
          Animated.spring(drag, { toValue: 0, ...motion.spring, useNativeDriver: nativeDriver }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (visible) setMounted(true);
    const animation = visible
      ? Animated.spring(progress, { toValue: 1, ...motion.springSoft, useNativeDriver: nativeDriver })
      : Animated.timing(progress, { toValue: 0, duration: 200, easing: easeOutSoft, useNativeDriver: nativeDriver });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [visible, progress]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!mounted) return null;

  const maxHeight = Dimensions.get('window').height * 0.92 - keyboard;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [Dimensions.get('window').height * 0.4, 0] });

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={dismissible ? onClose : undefined}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: progress }, Platform.OS === 'web' ? ({ backdropFilter: 'blur(3px)' } as object) : null]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismissible ? onClose : undefined} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight,
              marginBottom: keyboard,
              paddingBottom: spacing.lg + (keyboard > 0 ? 0 : insets.bottom),
              backgroundColor: colors.solid,
              borderColor: colors.border,
              transform: [{ translateY: Animated.add(translateY, drag) }],
            },
            shadows.liftHi(),
          ]}
        >
          <View {...pan.panHandlers}>
          <View style={{ paddingBottom: 4 }}>
            <View style={[styles.handle, { backgroundColor: colors.border2 }]} />
          </View>
          {title ? (
            <View style={[styles.head, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                {eyebrow ? <Text style={[typography.microLabelTracked105, { color: colors.signalText, marginBottom: 4 }]}>{eyebrow}</Text> : null}
                <Text style={[typography.bigHeadline22, { color: colors.text }]}>{title}</Text>
                {sub ? <Text style={[typography.body13, { color: colors.muted, marginTop: 5 }]}>{sub}</Text> : null}
              </View>
              {dismissible ? (
                <PressableScale accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} scaleTo={0.9} style={[styles.close, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Icon name="close" size={15} color={colors.muted} />
                </PressableScale>
              ) : null}
            </View>
          ) : null}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: 10, paddingHorizontal: spacing.gutter },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', paddingBottom: 14, marginBottom: 16, borderBottomWidth: 1 },
  close: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
});
