import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

/** The design's `cubic-bezier(0.2, 0.8, 0.2, 1)` ease-out. */
export const easeOutSoft = Easing.bezier(0.2, 0.8, 0.2, 1);

interface FadeInUpProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fade + slide-up entrance, used for cards, empty states and list sections. */
export function FadeInUp({ children, delay = 0, duration = 260, distance = 8, style }: FadeInUpProps) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration, delay, easing: Easing.out(Easing.quad), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress, delay, duration]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface GrowProps {
  axis: 'x' | 'y';
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

/** A block that grows from its left (axis x) or bottom (axis y) edge on mount - the bar-chart entrance. */
export function Grow({ axis, style, duration = 420 }: GrowProps) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration, easing: easeOutSoft, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress, duration]);
  return (
    <Animated.View
      style={[
        style,
        axis === 'x'
          ? { transformOrigin: 'left center', transform: [{ scaleX: progress }] }
          : { transformOrigin: 'center bottom', transform: [{ scaleY: progress }] },
      ]}
    />
  );
}
