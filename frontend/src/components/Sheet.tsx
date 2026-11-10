import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { easeOutSoft } from './motion';

interface MiraveltSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Dark (ink) or light (paper) surface; also picks the heavy vs medium scrim. */
  dark?: boolean;
  /** Set false to block dismissal by tapping outside / back (e.g. mid-upload). */
  dismissible?: boolean;
}

/**
 * A modal bottom sheet matching the design's sheet spec: radius 28 top
 * corners, drag handle, dark or light surface, heavy/medium scrim depending on
 * `dark`. Declarative (`visible`) rather than an imperative show-and-await.
 */
export function MiraveltSheet({ visible, onClose, children, dark = true, dismissible = true }: MiraveltSheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 280 : 200,
      easing: easeOutSoft,
      useNativeDriver: true,
    });
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

  const maxHeight = Dimensions.get('window').height * 0.9 - keyboard;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [Dimensions.get('window').height * 0.5, 0] });

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={dismissible ? onClose : undefined}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? colors.scrimHeavy : colors.scrimMedium, opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismissible ? onClose : undefined} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight,
              marginBottom: keyboard,
              paddingBottom: spacing.lg + (keyboard > 0 ? 0 : insets.bottom),
              backgroundColor: dark ? colors.ink850 : colors.card,
              borderColor: dark ? colors.hairlineDark : colors.hairlineLight,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: dark ? colors.hairlineDark : colors.hairlineLight }]} />
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
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 14,
    paddingHorizontal: spacing.gutter,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginBottom: 14 },
});
