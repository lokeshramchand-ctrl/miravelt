import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, withAlpha } from '../theme/colors';
import { typography } from '../theme/typography';
import { easeOutSoft, Grow, nativeDriver } from './motion';
import { haptics } from '../lib/haptics';

/* Chart kit ported from the SPL Console dashboard (components/Charts.tsx): flat fills, tick
   meters instead of progress bars, a 270° gauge for one bounded reading, spark lines/bars,
   and a context meter that splits a total by part. Every chart is tappable where the
   dashboard's is hoverable. */

// ---------------------------------------------------------------------------
// Ticks: a row of short bars, filled left to right, each lighting up in turn.

function Tick({ on, color, index, height }: { on: boolean; color: string; index: number; height: number }) {
  const t = useRef(new Animated.Value(on ? 0 : 1)).current;
  useEffect(() => {
    if (!on) return;
    const a = Animated.timing(t, { toValue: 1, duration: 420, delay: index * 14, easing: easeOutSoft, useNativeDriver: nativeDriver });
    a.start();
    return () => a.stop();
  }, [on, t, index]);
  return (
    <Animated.View
      style={{
        flex: 1,
        height,
        marginRight: 2,
        borderRadius: 2,
        backgroundColor: on ? color : colors.surface2,
        borderWidth: on ? 0 : 1,
        borderColor: colors.border,
        opacity: on ? t.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) : 1,
        transform: on ? [{ scaleY: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] : [],
      }}
    />
  );
}

/** Compact tick meter (0-1). Replaces the plain progress bar. */
export function Ticks({ value, color, n = 28, height = 10 }: { value: number; color?: string; n?: number; height?: number }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const lit = v > 0 ? Math.max(1, Math.round(v * n)) : 0;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }} style={{ flexDirection: 'row', alignItems: 'center', marginRight: -2 }}>
      {Array.from({ length: n }, (_, i) => (
        <Tick key={i} on={i < lit} color={color ?? colors.signal} index={i} height={height} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ContextMeter: a total split by part. Tap a part (legend row) to isolate it; the header reads it out.

export interface MeterPart {
  label: string;
  value: number;
  color: string;
}

export function ContextMeter({ parts, total, fmt, ticks = 40, onOpen, maxLegend = 5, legend: showLegend = true }: { parts: MeterPart[]; total: number; fmt: (v: number) => string; ticks?: number; onOpen?: (label: string) => void; maxLegend?: number; legend?: boolean }) {
  const [focus, setFocus] = useState<number | null>(null);
  const cap = Math.max(total, 1e-9);
  const owner: (number | null)[] = [];
  for (let i = 0; i < ticks; i++) {
    const at = ((i + 0.5) / ticks) * cap;
    let acc = 0;
    let who: number | null = null;
    for (let j = 0; j < parts.length; j++) {
      acc += Math.max(0, parts[j].value);
      if (at <= acc) {
        who = j;
        break;
      }
    }
    owner.push(who);
  }
  const fp = focus != null ? parts[focus] : null;
  const legend = parts.slice(0, maxLegend);
  const rest = parts.slice(maxLegend);
  const restTotal = rest.reduce((a, p) => a + p.value, 0);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        {fp ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{ width: 9, height: 9, borderRadius: 2.5, backgroundColor: fp.color, marginRight: 8 }} />
            <Text numberOfLines={1} style={[typography.rowLabel14, { color: colors.text, flexShrink: 1 }]}>{fp.label}</Text>
            <Text style={[typography.amountMedium16, { color: colors.text, marginLeft: 8 }]}>{fmt(fp.value)}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flex: 1 }}>
            <Text style={[typography.amountMedium20, { color: colors.text }]}>{fmt(total)}</Text>
            <Text style={[typography.meta12, { color: colors.muted, marginLeft: 6 }]}>spent across {parts.length} categories</Text>
          </View>
        )}
        <View style={[styles.pct, { backgroundColor: fp ? withAlpha(fp.color, 0.14) : colors.surface2 }]}>
          <Text style={[typography.badge10, { color: fp ? fp.color : colors.muted }]}>{fp ? `${Math.round((fp.value / cap) * 100)}%` : '100%'}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 14, marginRight: -2 }}>
        {owner.map((o, i) => {
          const dim = focus != null && o !== focus;
          return (
            <Pressable key={i} onPress={() => { haptics.select(); setFocus(o === focus ? null : o); }} style={{ flex: 1, marginRight: 2 }} accessibilityElementsHidden importantForAccessibility="no">
              <View style={{ height: o != null && o === focus ? 30 : 24, marginTop: o != null && o === focus ? 0 : 6, borderRadius: 2.5, backgroundColor: o == null ? colors.surface2 : parts[o].color, opacity: dim ? 0.22 : 1 }} />
            </Pressable>
          );
        })}
      </View>
      {showLegend ? (
      <View style={{ marginTop: 14 }}>
        {legend.map((p, j) => {
          const on = focus === j;
          return (
            <Pressable
              key={p.label}
              accessibilityRole="button"
              accessibilityLabel={`${p.label}, ${fmt(p.value)}, ${Math.round((p.value / cap) * 100)} percent`}
              onPress={() => { haptics.select(); setFocus(on ? null : j); }}
              onLongPress={onOpen ? () => onOpen(p.label) : undefined}
              style={({ pressed }) => [styles.legendRow, { backgroundColor: on ? colors.surface2 : pressed ? colors.surface2 : 'transparent', opacity: focus != null && !on ? 0.55 : 1 }]}
            >
              <View style={{ width: 9, height: 9, borderRadius: 2.5, backgroundColor: p.color }} />
              <Text numberOfLines={1} style={[typography.rowLabel14, { color: colors.text, flex: 1, marginLeft: 10 }]}>{p.label}</Text>
              <Text style={[typography.amountMedium14, { color: colors.text }]}>{fmt(p.value)}</Text>
              <Text style={[typography.meta12, { color: colors.muted, width: 42, textAlign: 'right' }]}>{Math.round((p.value / cap) * 100)}%</Text>
            </Pressable>
          );
        })}
        {rest.length > 0 ? (
          <View style={[styles.legendRow, { opacity: focus != null ? 0.55 : 1 }]}>
            <View style={{ width: 9, height: 9, borderRadius: 2.5, backgroundColor: colors.surface3 }} />
            <Text style={[typography.rowLabel14, { color: colors.muted, flex: 1, marginLeft: 10 }]}>{rest.length} more</Text>
            <Text style={[typography.amountMedium14, { color: colors.muted }]}>{fmt(restTotal)}</Text>
            <Text style={[typography.meta12, { color: colors.muted, width: 42, textAlign: 'right' }]}>{Math.round((restTotal / cap) * 100)}%</Text>
          </View>
        ) : null}
      </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gauge: a 270° arc with the value in the middle, for one bounded reading.

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function Gauge({ value, max = 1, display, unit, label, sub, color, size = 116, track, textColor, mutedColor }: {
  value: number;
  max?: number;
  display: string;
  unit?: string;
  label?: string;
  sub?: string;
  color?: string;
  size?: number;
  track?: string;
  textColor?: string;
  mutedColor?: string;
}) {
  const r = 42;
  const C = 2 * Math.PI * r;
  const arc = C * 0.75;
  const pct = Math.max(0, Math.min(1, value / (max || 1)));
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(t, { toValue: pct, duration: 900, easing: easeOutSoft, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [pct, t]);
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }} style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={r} fill="none" stroke={track ?? colors.surface2} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${arc} ${C}`} transform="rotate(135 50 50)" />
          <AnimatedCircle
            cx={50}
            cy={50}
            r={r}
            fill="none"
            stroke={color ?? colors.signal}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${C}`}
            strokeDashoffset={t.interpolate({ inputRange: [0, 1], outputRange: [arc, 0] })}
            transform="rotate(135 50 50)"
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={[typography.amountMedium20, { fontSize: size * 0.22, color: textColor ?? colors.text }]}>{display}</Text>
            {unit ? <Text style={[typography.meta12, { color: mutedColor ?? colors.muted, marginLeft: 1 }]}>{unit}</Text> : null}
          </View>
        </View>
      </View>
      {label ? <Text style={[typography.meta12, { color: textColor ?? colors.text, marginTop: -8 }]}>{label}</Text> : null}
      {sub ? <Text style={[typography.footnote1155, { color: mutedColor ?? colors.muted, marginTop: 1 }]}>{sub}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Spark bars / spark line: the small trend glyph beside a stat value.

export function SparkBars({ values, n = 14, color, height = 30, width, dimColor }: { values: number[]; n?: number; color?: string; height?: number; /** Omit to fill the parent's width. */ width?: number; dimColor?: string }) {
  const v = values.slice(-n);
  if (v.length < 2) return null;
  const top = Math.max(...v, 1e-9);
  return (
    <View style={{ width: width ?? '100%', height, flexDirection: 'row', alignItems: 'flex-end' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {v.map((x, i) => (
        <View key={i} style={{ flex: 1, height: `${Math.max(10, (x / top) * 100)}%`, marginLeft: i === 0 ? 0 : 2 }}>
          <Grow axis="y" delay={i * 18} style={{ flex: 1, borderRadius: 1.5, backgroundColor: i === v.length - 1 ? (color ?? colors.signal) : (dimColor ?? withAlpha(color ?? colors.signal, 0.28)) }} />
        </View>
      ))}
    </View>
  );
}

/** Monotone cubic through points (the dashboard's `monotone`). */
export function monotone(p: [number, number][]): string {
  if (p.length < 2) return '';
  const n = p.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(p[i + 1][0] - p[i][0]);
    m.push((p[i + 1][1] - p[i][1]) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${p[i][0] + h},${p[i][1] + t[i] * h},${p[i + 1][0] - h},${p[i + 1][1] - t[i + 1] * h},${p[i + 1][0]},${p[i + 1][1]}`;
  }
  return d;
}

export function SparkLine({ values, n = 30, color, width = 88, height = 30 }: { values: number[]; n?: number; color?: string; width?: number; height?: number }) {
  const v = values.slice(-n).filter(Number.isFinite);
  if (v.length < 2) return null;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const span = hi - lo || 1;
  const pts = v.map((x, i) => [(i / (v.length - 1)) * width, height - 3 - ((x - lo) / span) * (height - 8)] as [number, number]);
  const d = monotone(pts);
  const last = pts[pts.length - 1];
  const c = color ?? colors.signal;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={`${d}L${width},${height}L0,${height}Z`} fill={withAlpha(c, 0.1)} />
      <Path d={d} stroke={c} strokeWidth={1.75} fill="none" strokeLinecap="round" />
      <Circle cx={last[0]} cy={last[1]} r={2.75} fill={c} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// MiniBarChart: monthly columns. Tap a column to read it; the latest is selected to start.

export interface MiniBarChartEntry {
  label: string;
  /** 0-1 */
  heightFraction: number;
  highlighted?: boolean;
  tooltip?: string;
}

export function MiniBarChart({ entries, height = 96, color }: { entries: MiniBarChartEntry[]; height?: number; dark?: boolean; color?: string }) {
  const initial = Math.max(0, entries.findIndex((e) => e.highlighted));
  const [sel, setSel] = useState(initial);
  const c = color ?? colors.ink;
  return (
    <View style={{ paddingTop: 30 }}>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end' }}>
        {entries.map((entry, i) => {
          const on = i === sel;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`${entry.label}${entry.tooltip ? `, ${entry.tooltip}` : ''}`}
              onPress={() => { if (i !== sel) haptics.select(); setSel(i); }}
              style={{ flex: 1, height: '100%', paddingHorizontal: 4, justifyContent: 'flex-end', alignItems: 'center' }}
            >
              {on && entry.tooltip ? (
                <View style={[styles.tooltip, { backgroundColor: colors.ink }]}>
                  <Text style={[typography.badge10, { color: colors.onInk }]}>{entry.tooltip}</Text>
                </View>
              ) : null}
              <View style={{ width: '100%', height: `${Math.min(1, Math.max(0.03, entry.heightFraction)) * 100}%` }}>
                <Grow axis="y" delay={i * 40} style={{ flex: 1, backgroundColor: on ? c : colors.surface3, borderRadius: 5 }} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: 1, backgroundColor: colors.border, marginTop: 0 }} />
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {entries.map((entry, i) => (
          <Text key={i} style={[typography.meta115, { flex: 1, textAlign: 'center', color: i === sel ? colors.text : colors.faint }]}>
            {entry.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Progress ring (the Analysing screen): the gauge's arc, closed.

export function ProgressRing({ percent, size = 180, centerLabel, centerSubLabel }: { percent: number; size?: number; centerLabel?: React.ReactNode; centerSubLabel?: string }) {
  const clamped = Math.min(100, Math.max(0, percent)) / 100;
  const stroke = 8;
  const r = size / 2 - stroke;
  const circumference = 2 * Math.PI * r;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.signal}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {centerLabel}
        {centerSubLabel ? <Text style={[typography.microLabelTracked105, { color: colors.muted, marginTop: 4 }]}>{centerSubLabel}</Text> : null}
      </View>
    </View>
  );
}

/** A flat pill progress bar whose fill eases to the new value (no gloss: bencho keeps meters flat). */
export function SweepProgressBar({ percent, height = 6, trackColor, fillColor }: { percent: number; height?: number; trackColor?: string; fillColor?: string }) {
  const w = useRef(new Animated.Value(0)).current;
  const clamped = Math.min(100, Math.max(0, percent));
  useEffect(() => {
    Animated.timing(w, { toValue: clamped, duration: 500, easing: easeOutSoft, useNativeDriver: false }).start();
  }, [clamped, w]);
  return (
    <View style={{ height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: trackColor ?? colors.surface2, borderWidth: 1, borderColor: colors.border }}>
      <Animated.View style={{ width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), height: '100%', borderRadius: height / 2, backgroundColor: fillColor ?? colors.signal }} />
    </View>
  );
}

/** A status dot with an expanding "ping" ring (bencho/obsidian `.dot::after`), for live/attention states. */
export function PulsingDot({ color, size = 6 }: { color: string; size?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1800, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: nativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.6, 0, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 2.4, 2.4] }) }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: { position: 'absolute', top: -26, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, zIndex: 2 },
  pct: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginLeft: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 10 },
});
