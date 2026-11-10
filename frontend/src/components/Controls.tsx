import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { typography } from '../theme/typography';
import type { TextStyle } from 'react-native';
import type { IconName } from './Display';

export interface NavTabSpec {
  label: string;
  icon: IconName;
}

/** The 3-tab floating pill bottom nav (Overview / Signals / Activity). */
export function FloatingBottomNav({ tabs, currentIndex, onPress }: { tabs: NavTabSpec[]; currentIndex: number; onPress: (index: number) => void }) {
  return (
    <View style={styles.nav}>
      {tabs.map((tab, i) => {
        const active = i === currentIndex;
        return (
          <Pressable
            key={tab.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => onPress(i)}
            style={[styles.tab, active && { backgroundColor: colors.ink700 }]}
          >
            {active ? <MaterialIcons name={tab.icon} size={14} color={colors.accent} style={{ marginRight: 6 }} /> : null}
            <Text style={[typography.buttonLabel13, { color: active ? colors.onDark : colors.onDarkFaint }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Header period selector chip: dot + label + caret. Tapping opens the Period switcher sheet. */
export function PeriodPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Switch period, currently ${label}`} onPress={onPress} style={{ height: 44, justifyContent: 'center' }}>
      <View style={styles.periodPill}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
        <Text style={[typography.buttonLabel14, { color: colors.onDark, marginLeft: 8 }]}>{label}</Text>
        <MaterialIcons name="keyboard-arrow-down" size={16} color={colors.onDark} style={{ marginLeft: 4 }} />
      </View>
    </Pressable>
  );
}

interface ScreenBackHeaderProps {
  /** Left-aligned title next to the back button. */
  title?: string;
  /** Centered title with a balancing spacer, for headers whose title must stay centered regardless of the back button's width. */
  centerTitle?: string;
  titleStyle?: TextStyle;
  dark?: boolean;
  onBack?: () => void;
}

/**
 * The back-button header row at the top of most secondary screens (Recurring,
 * Category drilldown, Manage periods, Profile, Register, Rejected file) -
 * centralised so the icon/size/tap-target stay consistent.
 */
export function ScreenBackHeader({ title, centerTitle, titleStyle, dark = true, onBack }: ScreenBackHeaderProps) {
  const color = dark ? colors.onDark : colors.onLight;
  const back = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      style={styles.backButton}
      hitSlop={4}
    >
      <MaterialIcons name="arrow-back-ios-new" size={18} color={color} />
    </Pressable>
  );
  if (centerTitle != null) {
    return (
      <View style={styles.row}>
        {back}
        <Text style={[titleStyle ?? typography.buttonLabel13, { flex: 1, textAlign: 'center', color: dark ? colors.onDarkMuted : colors.onLightMuted }]}>{centerTitle}</Text>
        <View style={{ width: 48 }} />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      {back}
      {title != null ? <Text style={[titleStyle ?? typography.navTitle15, { color, marginLeft: 4 }]}>{title}</Text> : null}
    </View>
  );
}

/** Settings-style row: title (+ optional sub-label) with a trailing switch (accent when ON, ink700 when OFF). */
export function ToggleRow({ title, subtitle, value, onChange }: { title: string; subtitle?: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15 }}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.rowLabel14, { color: colors.onDark }]}>{title}</Text>
        {subtitle ? <Text style={[typography.footnote1155, { color: colors.onDarkFaint, marginTop: 3 }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.ink700 }}
        thumbColor={value ? colors.accentInk : colors.onDarkFaint}
        ios_backgroundColor={colors.ink700}
      />
    </View>
  );
}

/** "Light / Dark / Auto" style pill segmented control. */
export function SegmentedControl<T extends string>({ options, value, onChange }: { options: readonly (readonly [T, string])[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map(([optionValue, label]) => {
        const selected = optionValue === value;
        return (
          <Pressable
            key={optionValue}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(optionValue)}
            style={[styles.segment, selected && { backgroundColor: colors.accent }]}
          >
            <Text style={[typography.buttonLabel12, { color: selected ? colors.accentInk : colors.onDarkMuted }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    padding: 7,
    backgroundColor: colors.ink900,
    borderWidth: 1,
    borderColor: colors.hairlineDark,
    borderRadius: 100,
    ...shadows.floatingNav,
  },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.hairlineDark,
    borderRadius: 100,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginLeft: -12 },
  segmented: { flexDirection: 'row', padding: 3, backgroundColor: colors.ink700, borderRadius: 100, alignSelf: 'flex-start' },
  segment: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100 },
});
