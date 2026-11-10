import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, TextStyle } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { motion } from '../theme/tokens';
import { typography } from '../theme/typography';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { Toggle } from './Delight';
import { nativeDriver, PressableScale } from './motion';
import { haptics } from '../lib/haptics';

/**
 * One pill slides to the selected option instead of each option repainting its own
 * background (the dashboard's `chips-ind`): springs on x, eases on width.
 */
function useSlidingIndicator(index: number) {
  const [layouts, setLayouts] = useState<Record<number, { x: number; width: number }>>({});
  const x = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const target = layouts[index];
  useEffect(() => {
    if (!target) return;
    if (!placed.current) {
      x.setValue(target.x);
      width.setValue(target.width);
      placed.current = true;
      return;
    }
    Animated.parallel([
      Animated.spring(x, { toValue: target.x, ...motion.spring, useNativeDriver: false }),
      Animated.spring(width, { toValue: target.width, ...motion.springSoft, useNativeDriver: false }),
    ]).start();
  }, [target?.x, target?.width, x, width, target]);
  const onItemLayout = (i: number) => (e: LayoutChangeEvent) => {
    const { x: lx, width: lw } = e.nativeEvent.layout;
    setLayouts((prev) => (prev[i]?.x === lx && prev[i]?.width === lw ? prev : { ...prev, [i]: { x: lx, width: lw } }));
  };
  return { ready: target != null, x, width, onItemLayout };
}

export interface NavTabSpec {
  label: string;
  icon: IconName;
}

/** The 3-tab floating pill nav (Overview / Signals / Activity) with a sliding ink indicator. */
export function FloatingBottomNav({ tabs, currentIndex, onPress }: { tabs: NavTabSpec[]; currentIndex: number; onPress: (index: number) => void }) {
  const ind = useSlidingIndicator(currentIndex);
  return (
    <View style={[styles.nav, { backgroundColor: colors.scheme === 'dark' ? 'rgba(29, 33, 39, 0.82)' : 'rgba(255, 255, 255, 0.72)', borderColor: colors.border }, Platform.OS === 'web' ? ({ backdropFilter: 'blur(18px) saturate(1.4)' } as object) : null, shadows.liftHi()]}>
      {ind.ready ? <Animated.View pointerEvents="none" style={[styles.navInd, { backgroundColor: colors.ink, left: ind.x, width: ind.width }]} /> : null}
      {tabs.map((tab, i) => {
        const active = i === currentIndex;
        const fg = active ? colors.onInk : colors.muted;
        return (
          <PressableScale
            key={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onLayout={ind.onItemLayout(i)}
            onPress={() => {
              if (!active) haptics.select();
              onPress(i);
            }}
            scaleTo={0.94}
            style={styles.tab}
          >
            <BouncyIcon active={active} name={tab.icon} color={fg} />
            <Text style={[typography.buttonLabel13, { color: fg, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_500Medium' }]}>{tab.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** A tab icon that pops (squash, overshoot, settle) the moment its tab becomes active. */
function BouncyIcon({ active, name, color }: { active: boolean; name: IconName; color: string }) {
  const t = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!active) return;
    t.setValue(0.55);
    Animated.spring(t, { toValue: 1, damping: 7, stiffness: 260, mass: 0.6, useNativeDriver: nativeDriver }).start();
  }, [active, t]);
  return (
    <Animated.View style={{ marginRight: 7, transform: [{ scale: t }, { rotate: t.interpolate({ inputRange: [0.55, 1, 1.2], outputRange: ['-14deg', '0deg', '6deg'] }) }] }}>
      <Icon name={name} size={17} color={color} />
    </Animated.View>
  );
}

/** Header period selector: a bordered pill with a live dot, the range and a caret. Opens the period switcher. */
export function PeriodPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale haptic="tap" accessibilityRole="button" accessibilityLabel={`Switch period, currently ${label}`} onPress={onPress} scaleTo={0.95} style={{ height: 44, justifyContent: 'center' }}>
      <View style={[styles.periodPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.up }} />
        <Text style={[typography.buttonLabel14, { color: colors.text, marginLeft: 8 }]}>{label}</Text>
        <Icon name="keyboard-arrow-down" size={14} color={colors.muted} style={{ marginLeft: 6 }} />
      </View>
    </PressableScale>
  );
}

interface ScreenBackHeaderProps {
  /** Left-aligned title next to the back button. */
  title?: string;
  /** Centered title with a balancing spacer, for headers whose title must stay centered regardless of the back button's width. */
  centerTitle?: string;
  titleStyle?: TextStyle;
  /** Kept for call-site compatibility; every surface now shares one palette. */
  dark?: boolean;
  onBack?: () => void;
  trailing?: React.ReactNode;
}

/** The back-button header row at the top of secondary screens: a round bordered back button and the title. */
export function ScreenBackHeader({ title, centerTitle, titleStyle, onBack, trailing }: ScreenBackHeaderProps) {
  const back = (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Back"
      haptic="tap"
      onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      scaleTo={0.9}
      hitSlop={4}
      style={({ pressed }) => [styles.backButton, { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.border }]}
    >
      <Icon name="arrow-back-ios-new" size={16} color={colors.text} />
    </PressableScale>
  );
  if (centerTitle != null) {
    return (
      <View style={styles.row}>
        {back}
        <Text style={[titleStyle ?? typography.buttonLabel13, { flex: 1, textAlign: 'center', color: colors.muted }]}>{centerTitle}</Text>
        {trailing ?? <View style={{ width: 40 }} />}
      </View>
    );
  }
  return (
    <View style={styles.row}>
      {back}
      {title != null ? <Text style={[titleStyle ?? typography.navTitle15, { color: colors.text, marginLeft: 12, flex: 1 }]}>{title}</Text> : <View style={{ flex: 1 }} />}
      {trailing}
    </View>
  );
}

/** Settings-style row: optional icon chip, title (+ sub-label) and a trailing switch. */
export function ToggleRow({ title, subtitle, value, onChange, icon }: { title: string; subtitle?: string; value: boolean; onChange: (value: boolean) => void; icon?: IconName }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 }}>
      {icon ? <RowIcon name={icon} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[typography.rowLabel14, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[typography.footnote1155, { color: colors.muted, marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      <Toggle label={title} value={value} onChange={onChange} />
    </View>
  );
}

/** The icon chip at the start of a settings row. */
export function RowIcon({ name }: { name: IconName }) {
  return (
    <View style={{ width: 32, height: 32, borderRadius: 10, marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }}>
      <Icon name={name} size={16} color={colors.text} />
    </View>
  );
}

/**
 * Pill segmented control / filter chips with a sliding indicator (bencho `.chips`): a recessed
 * `--surface-2` track and one raised `--surface` pill that springs to the selection. Options
 * can carry a count, shown as a small tabular badge.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  counts,
  stretch = false,
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
  counts?: Partial<Record<T, number>>;
  stretch?: boolean;
}) {
  const index = Math.max(0, options.findIndex(([v]) => v === value));
  const ind = useSlidingIndicator(index);
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: colors.surface2, borderColor: colors.border }, stretch ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }]}>
      {ind.ready ? (
        <Animated.View pointerEvents="none" style={[styles.segInd, { left: ind.x, width: ind.width, backgroundColor: colors.surface, borderColor: colors.border }, shadows.lift()]} />
      ) : null}
      {options.map(([optionValue, label], i) => {
        const selected = optionValue === value;
        const count = counts?.[optionValue];
        return (
          <Pressable
            key={optionValue}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={count != null ? `${label}, ${count}` : label}
            onLayout={ind.onItemLayout(i)}
            onPress={() => {
              if (!selected) haptics.select();
              onChange(optionValue);
            }}
            style={[styles.segment, stretch && { flex: 1, justifyContent: 'center' }]}
          >
            <Text style={[typography.buttonLabel13, { color: selected ? colors.text : colors.muted, fontFamily: selected ? 'Inter_600SemiBold' : 'Inter_500Medium' }]}>{label}</Text>
            {count != null ? (
              <View style={[styles.count, { backgroundColor: selected ? colors.surface2 : colors.surface3 }]}>
                <Text style={[typography.badge10, { color: selected ? colors.text : colors.muted }]}>{count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', padding: 6, borderWidth: 1, borderRadius: 999 },
  navInd: { position: 'absolute', top: 6, bottom: 6, borderRadius: 999 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 999 },
  periodPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderRadius: 999 },
  row: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: 999, borderWidth: 1 },
  segInd: { position: 'absolute', top: 3, bottom: 3, borderRadius: 999, borderWidth: 1 },
  segment: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  count: { marginLeft: 6, minWidth: 18, paddingHorizontal: 5, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
