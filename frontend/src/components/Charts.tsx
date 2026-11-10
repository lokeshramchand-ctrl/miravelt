import { useEffect, useRef } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Grow } from './motion';

export interface MiniBarChartEntry {
  label: string;
  /** 0-1 */
  heightFraction: number;
  highlighted?: boolean;
  tooltip?: string;
}

/** Monthly mini bar chart - translucent bars, one highlighted/current month in solid accent with a floating value tooltip. */
export function MiniBarChart({ entries, height = 78, dark = true }: { entries: MiniBarChartEntry[]; height?: number; dark?: boolean }) {
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end' }}>
        {entries.map((entry, i) => (
          <View key={i} style={{ flex: 1, height: '100%', paddingHorizontal: 2.5, justifyContent: 'flex-end', alignItems: 'center' }}>
            {entry.highlighted && entry.tooltip ? (
              <View style={styles.tooltip}>
                <Text style={[typography.badge10, { color: colors.accentInk }]}>{entry.tooltip}</Text>
              </View>
            ) : null}
            <View style={{ width: '100%', height: `${Math.min(1, Math.max(0.02, entry.heightFraction)) * 100}%` }}>
              <Grow
                axis="y"
                style={{
                  flex: 1,
                  backgroundColor: entry.highlighted ? colors.accent : 'rgba(255, 255, 255, 0.14)',
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }}
              />
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {entries.map((entry, i) => (
          <Text key={i} style={[typography.meta115, { flex: 1, textAlign: 'center', color: dark ? colors.onDarkFaint : colors.onLightFaint }]}>
            {entry.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const RING_STROKE = 10;

/**
 * Circular job-progress ring: accent sweep vs a translucent track, with a glow
 * and a centered readout - matches the Analysing screen's 172px ring.
 */
export function ProgressRing({
  percent,
  size = 172,
  centerLabel,
  centerSubLabel,
}: {
  percent: number;
  size?: number;
  centerLabel?: React.ReactNode;
  centerSubLabel?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent)) / 100;
  const r = size / 2 - 6;
  const circumference = 2 * Math.PI * r;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }, glow]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255, 255, 255, 0.08)" strokeWidth={RING_STROKE} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          // Start at 12 o'clock rather than 3.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ width: size * 0.8, height: size * 0.8, borderRadius: size * 0.4, backgroundColor: colors.ink900, alignItems: 'center', justifyContent: 'center' }}>
        {centerLabel}
        {centerSubLabel ? <Text style={[typography.microLabelTracked105, { color: colors.onDarkFaint, marginTop: 4 }]}>{centerSubLabel}</Text> : null}
      </View>
    </View>
  );
}

const glow = {
  shadowColor: colors.accent,
  shadowOpacity: 0.35,
  shadowRadius: 30,
  shadowOffset: { width: 0, height: 0 },
} as const;

/** A pill progress bar with an animated diagonal shine sweeping across the fill (the design's `vsweep`, ~1.5s ease-in-out infinite). */
export function SweepProgressBar({ percent, height = 6, trackColor, fillColor }: { percent: number; height?: number; trackColor?: string; fillColor?: string }) {
  const sweep = useRef(new Animated.Value(0)).current;
  const [fillWidth, setFillWidth] = useState(0);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  const clamped = Math.min(100, Math.max(0, percent));
  const shineWidth = Math.max(40, fillWidth * 0.5);
  return (
    <View style={{ height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: trackColor ?? colors.ink700 }}>
      <View
        onLayout={(e: LayoutChangeEvent) => setFillWidth(e.nativeEvent.layout.width)}
        style={{ width: `${clamped}%`, height: '100%', backgroundColor: fillColor ?? colors.accent, overflow: 'hidden' }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: shineWidth,
            transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-shineWidth, fillWidth] }) }],
          }}
        >
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
      </View>
    </View>
  );
}

/** The `vpulse` keyframe: opacity .35<->.9, scale 1<->1.35, ~1.5s ease-in-out infinite. For "analysing" live dots. */
export function PulsingDot({ color, size = 6 }: { color: string; size?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  tooltip: { position: 'absolute', top: -22, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100, backgroundColor: colors.accent },
});
