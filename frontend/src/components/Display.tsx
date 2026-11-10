import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { FadeInUp, Grow } from './motion';
import { AvatarChip } from './Avatars';
import { PrimaryPillButton, SecondaryPillButton, TextActionLink } from './Buttons';
import type { InsightSeverity } from '../domain/types';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

// ---------------------------------------------------------------------------

interface DeltaChipProps {
  /** Includes its own arrow glyph (e.g. "▲ 12%"), rendered as-is. */
  label: string;
  /** Not rendered directly; gives screen readers a spoken direction independent of the glyph. */
  up: boolean;
  tint: string;
  foreground: string;
}

/** Pill: tinted background + colored text carrying its own direction glyph, e.g. "▲ 12%". */
export function DeltaChip({ label, up, tint, foreground }: DeltaChipProps) {
  return (
    <View accessible accessibilityLabel={`${up ? 'Increased' : 'Decreased'} ${label}`} style={[styles.deltaChip, { backgroundColor: tint }]}>
      <Text style={[typography.buttonLabel12, { color: foreground }]}>{label}</Text>
    </View>
  );
}

/** Small uppercase pill tag, e.g. "UNUSUAL", "WATCH", "ANALYSING". */
export function MicroBadge({ label, tint, foreground }: { label: string; tint: string; foreground: string }) {
  return (
    <View style={[styles.microBadge, { backgroundColor: tint }]}>
      <Text style={[typography.badge95, { color: foreground }]}>{label}</Text>
    </View>
  );
}

/** "SIGNALS ... All 5 →" style row: tracked micro-label with an optional trailing action. */
export function SectionHeader({ label, labelColor, trailing }: { label: string; labelColor: string; trailing?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[typography.microLabelTracked11, { color: labelColor }]}>{label}</Text>
      {trailing}
    </View>
  );
}

// ---------------------------------------------------------------------------

interface EmptyStateProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  dark?: boolean;
  cta?: React.ReactNode;
}

/** A centered icon + title + optional subtitle/CTA, for a list or section with no data (as opposed to loading or errored). */
export function EmptyState({ icon, title, subtitle, dark = false, cta }: EmptyStateProps) {
  const onSurface = dark ? colors.onDark : colors.onLight;
  const muted = dark ? colors.onDarkMuted : colors.onLightMuted;
  return (
    <FadeInUp style={styles.centerBlock}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: dark ? colors.ink800 : colors.card, borderColor: dark ? colors.hairlineDark : colors.hairlineLight },
        ]}
      >
        <MaterialIcons name={icon} size={22} color={muted} />
      </View>
      <Text style={[typography.rowLabel145, styles.centerText, { color: onSurface, marginTop: 16 }]}>{title}</Text>
      {subtitle ? <Text style={[typography.footnote12, styles.centerText, { color: muted, marginTop: 6 }]}>{subtitle}</Text> : null}
      {cta ? <View style={{ marginTop: 18 }}>{cta}</View> : null}
    </FadeInUp>
  );
}

/** Centered error message + Retry CTA, so a failed load is always recoverable without a full app reload. */
export function ErrorRetry({ onRetry, message, dark = false }: { onRetry: () => void; message?: string; dark?: boolean }) {
  const muted = dark ? colors.onDarkMuted : colors.onLightMuted;
  return (
    <View style={[styles.centerBlock, { paddingVertical: 30 }]}>
      <MaterialIcons name="cloud-off" size={28} color={muted} />
      <Text style={[typography.footnote15, styles.centerText, { color: muted, marginTop: 12 }]}>{message ?? 'Something went wrong.'}</Text>
      <View style={{ marginTop: 16 }}>
        {dark ? (
          <SecondaryPillButton label="Retry" expand={false} foreground={colors.onDark} borderColor={colors.hairlineDark} onPress={onRetry} />
        ) : (
          <PrimaryPillButton label="Retry" expand={false} onPress={onRetry} />
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

interface CategoryBarRowProps {
  name: string;
  amountLabel: string;
  percentOfTotal: number;
  /** 0-1, relative to the largest category (not an absolute percentage of the total). */
  relativeWidthFraction: number;
  color: string;
  trendCaption?: string;
  onPress?: () => void;
}

/** A ranked category row: name + amount header, then a track + fill bar, a %, and an optional trend caption. */
export function CategoryBarRow({ name, amountLabel, percentOfTotal, relativeWidthFraction, color, trendCaption, onPress }: CategoryBarRowProps) {
  const fraction = Math.min(1, Math.max(0, relativeWidthFraction));
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [{ paddingVertical: 10 }, pressed && { opacity: 0.6 }]}>
      <View style={styles.row}>
        <Text numberOfLines={1} style={[typography.rowLabel14, { color: colors.onLight, flex: 1 }]}>
          {name}
        </Text>
        <Text style={[typography.amountMedium14, { color: colors.onLight, marginLeft: 8 }]}>{amountLabel}</Text>
      </View>
      <View style={[styles.row, { marginTop: 8 }]}>
        <View style={styles.barTrack}>
          <View style={{ width: `${fraction * 100}%`, height: '100%' }}>
            <Grow axis="x" style={{ flex: 1, backgroundColor: color }} />
          </View>
        </View>
        <Text style={[typography.microLabel11, { color: colors.onLightMuted, width: 34, textAlign: 'right' }]}>{percentOfTotal}%</Text>
      </View>
      {trendCaption ? <Text style={[typography.footnote1155, { color, marginTop: 4 }]}>{trendCaption}</Text> : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

interface MiraveltListRowProps {
  avatarInitials: string;
  avatarTint: string;
  avatarInk: string;
  title: string;
  subtitle: string;
  trailingAmount: string;
  trailingAmountColor?: string;
  badgeLabel?: string;
  onPress?: () => void;
  dark?: boolean;
  avatarGradient?: React.ComponentProps<typeof AvatarChip>['gradient'];
}

/** Generic row: avatar + 2-line text block + trailing amount + optional badge. Backs merchant rows, transaction rows and subscription headers. */
export function MiraveltListRow(p: MiraveltListRowProps) {
  const dark = p.dark ?? false;
  const onSurface = dark ? colors.onDark : colors.onLight;
  const faint = dark ? colors.onDarkFaint : colors.onLightFaint;
  return (
    <Pressable onPress={p.onPress} disabled={!p.onPress} accessibilityRole={p.onPress ? 'button' : undefined} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}>
      <AvatarChip initials={p.avatarInitials} size={38} radius={12} backgroundColor={p.avatarTint} foregroundColor={p.avatarInk} gradient={p.avatarGradient} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text numberOfLines={1} style={[typography.rowLabel145, { color: onSurface }]}>
          {p.title}
        </Text>
        <Text numberOfLines={1} style={[typography.meta115, { color: faint, marginTop: 2 }]}>
          {p.subtitle}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
        <Text style={[typography.amountMedium15, { color: p.trailingAmountColor ?? onSurface }]}>{p.trailingAmount}</Text>
        {p.badgeLabel ? (
          <View style={{ marginTop: 4 }}>
            <MicroBadge label={p.badgeLabel} tint={colors.amberTint} foreground={colors.amberInk} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

/** Small stat card: micro-label + Space Grotesk value, e.g. the "PERIODS / TXNS ANALYSED / CORRECTIONS" row on Profile. */
export function StatTile({ label, value, valueColor, dark = true }: { label: string; value: string; valueColor?: string; dark?: boolean }) {
  return (
    <View
      style={[
        styles.statTile,
        { backgroundColor: dark ? colors.ink850 : colors.card, borderColor: dark ? colors.hairlineDark : colors.hairlineLight },
      ]}
    >
      <Text style={[typography.microLabel11, { color: dark ? colors.onDarkFaint : colors.onLightFaint }]}>{label}</Text>
      <Text style={[typography.amountMedium20, { color: valueColor ?? (dark ? colors.onDark : colors.onLight), marginTop: 6 }]}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

export type SignalKind = 'watch' | 'good' | 'context';

export function signalKindFromSeverity(severity: InsightSeverity): SignalKind {
  switch (severity) {
    case 'WARNING':
      return 'watch';
    case 'POSITIVE':
      return 'good';
    default:
      return 'context';
  }
}

const withAlpha = (rgba: string, alpha: number) => rgba.replace(/rgba\((\d+), (\d+), (\d+), [\d.]+\)/, `rgba($1, $2, $3, ${alpha})`);

const SIGNAL_STYLE: Record<SignalKind, { tint: string; ink: string; label: string; icon: IconName }> = {
  watch: { tint: withAlpha(colors.amber, 0.2), ink: colors.amber, label: 'WATCH', icon: 'priority-high' },
  good: { tint: withAlpha(colors.accent, 0.2), ink: colors.accent, label: 'GOOD', icon: 'check' },
  context: { tint: withAlpha(colors.sky, 0.2), ink: colors.sky, label: 'CONTEXT', icon: 'info-outline' },
};

export { withAlpha };

/** A FadeInUp that takes the card's own style - the entrance used by list cards. */
export function FadeInUpCard({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <FadeInUp delay={delay} duration={240} distance={6} style={style}>
      {children}
    </FadeInUp>
  );
}

interface SignalCardProps {
  kind: SignalKind;
  subtype: string;
  body: string;
  evidence?: string;
  ctaLabel?: string;
  onCta?: () => void;
  dark?: boolean;
  entranceDelayMs?: number;
}

/** A ranked, typed insight card - the design's core "signal" primitive, on Overview (preview) and Signals (full list). */
export function SignalCard({ kind, subtype, body, evidence, ctaLabel, onCta, dark = true, entranceDelayMs = 0 }: SignalCardProps) {
  const { tint, ink, label, icon } = SIGNAL_STYLE[kind];
  return (
    <FadeInUp
      delay={entranceDelayMs}
      duration={240}
      distance={6}
      style={[styles.signalCard, { backgroundColor: dark ? colors.ink850 : colors.card, borderColor: dark ? colors.hairlineDark : colors.hairlineLight }]}
    >
      <View style={styles.row}>
        <View style={[styles.signalIcon, { backgroundColor: tint }]}>
          <MaterialIcons name={icon} size={12} color={ink} />
        </View>
        <Text style={[typography.microLabelTracked105, { color: ink, marginLeft: 8 }]}>{label}</Text>
        <View style={{ flex: 1 }} />
        <Text numberOfLines={1} style={[typography.microLabel11, { color: dark ? colors.onDarkFaint : colors.onLightFaint, flexShrink: 1 }]}>
          {subtype}
        </Text>
      </View>
      <Text style={[typography.cardBody15, { color: dark ? colors.onDark : colors.onLight, marginTop: 10 }]}>{body}</Text>
      {evidence || ctaLabel ? (
        <View style={[styles.evidence, { backgroundColor: dark ? colors.ink800 : colors.paper }]}>
          {evidence ? <Text style={[typography.meta115, { color: dark ? colors.onDarkMuted : colors.onLightMuted, flex: 1 }]}>{evidence}</Text> : <View style={{ flex: 1 }} />}
          {ctaLabel && onCta ? <TextActionLink label={ctaLabel} onPress={onCta} color={colors.accent} /> : null}
        </View>
      ) : null}
    </FadeInUp>
  );
}

// ---------------------------------------------------------------------------

export type RegularitySegmentState = 'paid' | 'skipped' | 'upcoming';

interface RegularityStripProps {
  states: RegularitySegmentState[];
  color: string;
  startLabel: string;
  endLabel: string;
  centerLabel: string;
}

/** Recurring-payment "rhythm strip": month segments - filled when paid, lighter when skipped, outlined when upcoming/projected. */
export function RegularityStrip({ states, color, startLabel, endLabel, centerLabel }: RegularityStripProps) {
  return (
    <View>
      <View style={styles.row}>
        {states.map((state, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              i > 0 && { marginLeft: 4 },
              state === 'paid' && { backgroundColor: withAlpha(color, 0.18) },
              state === 'skipped' && { backgroundColor: colors.skeletonHighlight },
              state === 'upcoming' && { borderWidth: 1.2, borderColor: color },
            ]}
          />
        ))}
      </View>
      <View style={[styles.row, { justifyContent: 'space-between', marginTop: 6 }]}>
        {[startLabel, centerLabel, endLabel].map((label, i) => (
          <Text key={i} style={[typography.meta115, { color: colors.onLightFaint }]}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  deltaChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.chip, alignSelf: 'flex-start' },
  microBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centerBlock: { alignItems: 'center', justifyContent: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  centerText: { textAlign: 'center' },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  barTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.progressTrackLight },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  statTile: { padding: 14, borderWidth: 1, borderRadius: radius.field + 4 },
  signalCard: { padding: 17, borderWidth: 1, borderRadius: radius.card },
  signalIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  evidence: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.field },
  segment: { flex: 1, height: 22, borderRadius: 6 },
});
