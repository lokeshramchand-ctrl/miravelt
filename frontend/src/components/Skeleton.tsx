import { useEffect, useRef } from 'react';
import { Animated, Easing, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme/colors';
import { nativeDriver } from './motion';

/** A placeholder block that pulses in opacity (bencho skeletons: flat `--surface-2`, no gradient sweep). */
export function SkeletonBox({ width, height, radius = 8, delay = 0 }: { width: number | `${number}%`; height: number; radius?: number; dark?: boolean; delay?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: nativeDriver }),
        Animated.timing(t, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  return <Animated.View style={{ width, height, borderRadius: radius, backgroundColor: colors.surface3, opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }} />;
}

/** A skeleton transaction/list row: chip + two text bars. */
export function SkeletonListRow({ index = 0 }: { dark?: boolean; index?: number }) {
  const { width } = useWindowDimensions();
  return (
    <View style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
      <SkeletonBox width={40} height={40} radius={12} delay={index * 90} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <SkeletonBox width={width * 0.42} height={13} delay={index * 90} />
        <View style={{ height: 7 }} />
        <SkeletonBox width={width * 0.28} height={10} delay={index * 90} />
      </View>
      <SkeletonBox width={64} height={14} delay={index * 90} />
    </View>
  );
}
