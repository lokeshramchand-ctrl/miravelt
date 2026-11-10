import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { haptics } from '../lib/haptics';
import { motion } from '../theme/tokens';

/** bencho's `--ease-out` (cubic-bezier(.22, 1, .36, 1)). */
export const easeOutSoft = Easing.bezier(0.22, 1, 0.36, 1);
/** The native driver is unavailable on web; fall back quietly there. */
export const nativeDriver = Platform.OS !== 'web';

interface FadeInUpProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fade + rise entrance, used for cards, empty states and list sections. */
export function FadeInUp({ children, delay = 0, duration = 320, distance = 8, style }: FadeInUpProps) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration, delay, easing: easeOutSoft, useNativeDriver: nativeDriver });
    animation.start();
    return () => animation.stop();
  }, [progress, delay, duration]);
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

interface GrowProps {
  axis: 'x' | 'y';
  style?: StyleProp<ViewStyle>;
  duration?: number;
  delay?: number;
}

/** A block that grows from its left (axis x) or bottom (axis y) edge on mount - the bar-chart entrance. */
export function Grow({ axis, style, duration = 520, delay = 0 }: GrowProps) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration, delay, easing: easeOutSoft, useNativeDriver: nativeDriver });
    animation.start();
    return () => animation.stop();
  }, [progress, duration, delay]);
  return (
    <Animated.View
      style={[
        style,
        axis === 'x' ? { transformOrigin: 'left center', transform: [{ scaleX: progress }] } : { transformOrigin: 'center bottom', transform: [{ scaleY: progress }] },
      ]}
    />
  );
}

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** How far it sinks while held (bencho buttons: .97, chips .96, icon buttons .9). */
  scaleTo?: number;
  /** Tactile feedback on press: `tap` for buttons, `select` for choosing something. */
  haptic?: 'tap' | 'select' | false;
  children?: React.ReactNode;
}

/**
 * bencho's press feel: the thing sinks a little while held and springs back with a slight
 * overshoot when released (`transform .35s var(--spring)`).
 */
export function PressableScale({ style, scaleTo = 0.97, haptic = false, children, onPressIn, onPressOut, onPress, ...rest }: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) => Animated.spring(scale, { toValue: value, ...motion.spring, useNativeDriver: nativeDriver }).start();
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        if (!rest.disabled) to(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
      onPress={
        onPress
          ? (e) => {
              if (haptic) haptics[haptic]();
              onPress(e);
            }
          : undefined
      }
    >
      {(state) => <Animated.View style={[typeof style === 'function' ? style(state) : style, { transform: [{ scale }] }]}>{children}</Animated.View>}
    </Pressable>
  );
}
