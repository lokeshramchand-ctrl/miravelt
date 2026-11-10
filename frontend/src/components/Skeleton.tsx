import { useEffect, useRef } from 'react';
import { Animated, Easing, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme/colors';

/** A shimmering placeholder block, matching the design's `vshimmer` sweep (1.4s linear infinite) for loading avatars/text lines/rows. */
export function SkeletonBox({ width, height, radius = 8, dark = false }: { width: number | `${number}%`; height: number; radius?: number; dark?: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(t, { toValue: 0, duration: 700, easing: Easing.linear, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  const base = dark ? colors.skeletonBaseDark : colors.skeletonBase;
  const highlight = dark ? colors.skeletonHighlightDark : colors.skeletonHighlight;
  return (
    <Animated.View
      style={{ width, height, borderRadius: radius, backgroundColor: t.interpolate({ inputRange: [0, 1], outputRange: [base, highlight] }) }}
    />
  );
}

/** A skeleton transaction/list row: avatar + two text bars. */
export function SkeletonListRow({ dark = false }: { dark?: boolean }) {
  const { width } = useWindowDimensions();
  return (
    <View style={{ opacity: 0.5, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
      <SkeletonBox width={38} height={38} radius={12} dark={dark} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <SkeletonBox width={width * 0.42} height={13} dark={dark} />
        <View style={{ height: 6 }} />
        <SkeletonBox width={width * 0.28} height={11} dark={dark} />
      </View>
    </View>
  );
}
