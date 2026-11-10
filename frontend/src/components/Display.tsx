import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, withAlpha } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { FadeInUp, PressableScale } from './motion';
import { PrimaryPillButton, SecondaryPillButton, TextActionLink } from './Buttons';
import { PulsingDot, SparkBars, SparkLine, Ticks } from './Charts';
import { AnimatedNumber } from './Delight';
import { Icon, IconChip } from './Icon';
import type { IconName } from './Icon';
import type { InsightSeverity } from '../domain/types';

export type { IconName };
export { withAlpha };

// ---------------------------------------------------------------------------

/** A flat card: `--surface`, 1px hairline, radius 16, the one soft `lift` shadow. */
const glass = Platform.OS === 'web' ? ({ backdropFilter: 'blur(14px) saturate(1.3)' } as object) : null;

/** A frosted glass card: translucent white over the backdrop, a bright hairline edge, radius 26. */
export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card }, glass, padded && { padding: 18 }, shadows.lift(), style]}>{children}</View>;
}

/** Hairline divider inside a card, optionally inset past a leading icon. */
export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: 1, marginLeft: inset, backgroundColor: colors.border }} />;
}

type Tone = 'up' | 'down' | 'warn' | 'signal' | 'neutral';
const toneColors = (tone: Tone) =>
  tone === 'up' ? { bg: colors.upSoft, fg: colors.upInk } : tone === 'down' ? { bg: colors.downSoft, fg: colors.downInk } : tone === 'warn' ? { bg: colors.warnSoft, fg: colors.warnInk } : tone === 'signal' ? { bg: colors.signalSoft, fg: colors.signalText } : { bg: colors.surface2, fg: colors.muted };

interface DeltaChipProps {
  /** Includes its own arrow glyph (e.g. "▲ 12%"), rendered as-is. */
  label: string;
  /** Not rendered directly; gives screen readers a spoken direction independent of the glyph. */
  up: boolean;
  /** Legacy tint/foreground pair; `tone` wins when given. */
  tint?: string;
  foreground?: string;
  tone?: Tone;
}

/** Trend pill (bencho `.delta`): tinted background + coloured text carrying its own direction glyph. */
export function DeltaChip({ label, up, tint, foreground, tone }: DeltaChipProps) {
  const t = tone ? toneColors(tone) : { bg: tint ?? colors.surface2, fg: foreground ?? colors.muted };
  return (
    <View accessible accessibilityLabel={`${up ? 'Increased' : 'Decreased'} ${label}`} style={[styles.deltaChip, { backgroundColor: t.bg }]}>
      <Text style={[typography.metaBold12, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/** Badge (bencho `.badge`): an uppercase pill, optionally with a live "ping" dot. */
export function MicroBadge({ label, tint, foreground, tone, ping = false }: { label: string; tint?: string; foreground?: string; tone?: Tone; ping?: boolean }) {
  const t = tone ? toneColors(tone) : { bg: tint ?? colors.surface2, fg: foreground ?? colors.muted };
  return (
    <View style={[styles.microBadge, { backgroundColor: t.bg }]}>
      {ping ? (
        <View style={{ marginRight: 5 }}>
          <PulsingDot color={t.fg} size={5} />
        </View>
      ) : null}
      <Text style={[typography.badge10, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const sentence = (s: string) => (s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s);

/** A section heading (bencho `h3`, 15px 600, sentence case) with an optional sub line and trailing action. */
export function SectionHeader({ label, trailing, sub }: { label: string; labelColor?: string; trailing?: React.ReactNode; sub?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.cardTitle, { color: colors.text }]}>{sentence(label)}</Text>
        {sub ? <Text style={[typography.footnote1155, { color: colors.muted, marginTop: 2 }]}>{sub}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

/** Uppercase signal-coloured eyebrow above a title (bencho `.eyebrow`). */
export function Eyebrow({ children, color }: { children: string; color?: string }) {
  return <Text style={[typography.microLabelTracked105, { color: color ?? colors.signalText }]}>{children}</Text>;
}

// ---------------------------------------------------------------------------

interface EmptyStateProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  dark?: boolean;
  cta?: React.ReactNode;
}

/** A centered icon chip + title + optional hint/CTA, for a list or section with no data (as opposed to loading or errored). */
export function EmptyState({ icon, title, subtitle, cta }: EmptyStateProps) {
  return (
    <FadeInUp style={styles.centerBlock}>
      <IconChip name={icon} size={46} iconSize={22} />
      <Text style={[typography.rowLabel145, styles.centerText, { color: colors.text, marginTop: 14, fontFamily: 'Inter_600SemiBold' }]}>{title}</Text>
      {subtitle ? <Text style={[typography.footnote12, styles.centerText, { color: colors.muted, marginTop: 6, maxWidth: 300 }]}>{subtitle}</Text> : null}
      {cta ? <View style={{ marginTop: 18 }}>{cta}</View> : null}
    </FadeInUp>
  );
}

/** Centered error message + Retry CTA, so a failed load is always recoverable without a full app reload. */
export function ErrorRetry({ onRetry, message }: { onRetry: () => void; message?: string; dark?: boolean }) {
  return (
    <View style={[styles.centerBlock, { paddingVertical: 30 }]}>
      <IconChip name="cloud-off" size={46} iconSize={22} tone="down" />
      <Text style={[typography.footnote15, styles.centerText, { color: colors.muted, marginTop: 12 }]}>{message ?? 'Something went wrong.'}</Text>
      <View style={{ marginTop: 16 }}>
        <SecondaryPillButton label="Retry" icon="autorenew" expand={false} onPress={onRetry} />
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

/** A ranked category row: colour dot, name, amount, then a tick meter, the share and an optional trend caption. */
export function CategoryBarRow({ name, amountLabel, percentOfTotal, relativeWidthFraction, color, trendCaption, onPress }: CategoryBarRowProps) {
  const up = trendCaption?.startsWith('↑');
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [styles.barRow, pressed && { backgroundColor: colors.surface2 }]}>
      <View style={styles.row}>
        <View style={{ width: 8, height: 8, borderRadius: 2.5, backgroundColor: color, marginRight: 9 }} />
        <Text numberOfLines={1} style={[typography.rowLabel14, { color: colors.text, flex: 1 }]}>
          {name}
        </Text>
        <Text style={[typography.amountMedium14, { color: colors.text, marginLeft: 8 }]}>{amountLabel}</Text>
        {onPress ? <Icon name="chevron-right" size={13} color={colors.faint} style={{ marginLeft: 6 }} /> : null}
      </View>
      <View style={[styles.row, { marginTop: 9 }]}>
        <View style={{ flex: 1 }}>
          <Ticks value={relativeWidthFraction} color={color} n={30} height={9} />
        </View>
        <Text style={[typography.meta12, { color: colors.muted, width: 40, textAlign: 'right' }]}>{percentOfTotal}%</Text>
      </View>
      {trendCaption ? <Text style={[typography.footnote1155, { color: up ? colors.down : colors.up, marginTop: 6 }]}>{trendCaption}</Text> : null}
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
  /** Overrides the initials with an icon. */
  icon?: IconName;
  avatarGradient?: unknown;
}

/** Generic row: icon/initial chip + 2-line text block + trailing amount + optional badge. Merchant, transaction and subscription rows. */
export function MiraveltListRow(p: MiraveltListRowProps) {
  return (
    <Pressable onPress={p.onPress} disabled={!p.onPress} accessibilityRole={p.onPress ? 'button' : undefined} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.surface2 }]}>
      {p.icon ? (
        <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: colors.border }}>
          <Icon name={p.icon} size={17} color={colors.text} />
          <View style={{ position: 'absolute', right: 1, bottom: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: p.avatarInk, borderWidth: 2, borderColor: colors.scheme === 'dark' ? '#1d2127' : '#ffffff' }} />
        </View>
      ) : (
        <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: p.avatarTint, borderWidth: 1, borderColor: withAlpha(p.avatarInk, 0.14) }}>
          <Text style={[typography.amountMedium15, { color: p.avatarInk }]}>{p.avatarInitials}</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text numberOfLines={1} style={[typography.rowLabel145, { color: colors.text }]}>
          {p.title}
        </Text>
        <Text numberOfLines={1} style={[typography.meta115, { color: colors.muted, marginTop: 3 }]}>
          {p.subtitle}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
        <Text style={[typography.amountMedium15, { color: p.trailingAmountColor ?? colors.text }]}>{p.trailingAmount}</Text>
        {p.badgeLabel ? (
          <View style={{ marginTop: 4 }}>
            <MicroBadge label={p.badgeLabel} tone="warn" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

/**
 * Stat card: a plain title with an ↗ in the corner, a small faint context line, then the value in
 * light figures with an optional pastel badge beside it. An optional spark sits under the title.
 */
export function Stat({ label, value, amount, format, unit, sub, spark, sparkKind = 'bars', sparkColor, trend, badge, onPress, style }: {
  icon?: IconName;
  label: string;
  value: string;
  /** When given (with `format`), the value counts up to it instead of appearing at once. */
  amount?: number;
  format?: (n: number) => string;
  unit?: string;
  sub?: string;
  spark?: number[];
  sparkKind?: 'bars' | 'line';
  sparkColor?: string;
  trend?: React.ReactNode;
  badge?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
}) {
  const inner = (
    <Card style={[{ padding: 16, minHeight: 128 }, style]}>
      <View style={styles.row}>
        <Text numberOfLines={1} style={[typography.cardTitle, { fontSize: 15, color: colors.text, flex: 1 }]}>
          {label}
        </Text>
        <Icon name="arrow-up-right" size={16} color={colors.text} />
      </View>
      {spark ? <View style={{ marginTop: 12 }}>{sparkKind === 'line' ? <SparkLine values={spark} width={120} height={24} color={sparkColor ?? colors.text} /> : <SparkBars values={spark} height={22} n={12} color={sparkColor ?? colors.text} />}</View> : null}
      <View style={{ flex: 1, minHeight: spark ? 10 : 22 }} />
      {sub || trend ? (
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {trend ? <View style={{ marginRight: 6 }}>{trend}</View> : null}
          {sub ? <Text style={[typography.footnote1155, { color: colors.faint, flexShrink: 1 }]}>{sub}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.row, { marginTop: 4, flexWrap: 'wrap' }]}>
        {amount != null && format ? (
          <AnimatedNumber value={amount} format={format} numberOfLines={1} style={[typography.statValue, { fontSize: 22, lineHeight: 28, color: colors.text, flexShrink: 1 }]} />
        ) : (
          <Text numberOfLines={1} adjustsFontSizeToFit style={[typography.statValue, { fontSize: 22, lineHeight: 28, color: colors.text, flexShrink: 1 }]}>{value}</Text>
        )}
        {unit ? <Text style={[typography.meta12, { color: colors.muted, marginLeft: 5 }]}>{unit}</Text> : null}
        {badge ? <View style={{ marginLeft: 8 }}>{badge}</View> : null}
      </View>
    </Card>
  );
  return onPress ? (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style} scaleTo={0.98}>
      {inner}
    </PressableScale>
  ) : (
    inner
  );
}

/** Small stat card used in rows of three (Profile): label + value. */
export function StatTile({ label, value, valueColor, icon }: { label: string; value: string; valueColor?: string; dark?: boolean; icon?: IconName }) {
  return (
    <Card style={{ padding: 13 }}>
      {icon ? <IconChip name={icon} size={26} iconSize={14} style={{ marginBottom: 12 }} /> : null}
      <Text style={[typography.statValue, { fontSize: 22, lineHeight: 26, color: valueColor ?? colors.text }]}>{value}</Text>
      <Text numberOfLines={2} style={[typography.meta115, { color: colors.muted, marginTop: 3 }]}>
        {label.charAt(0) + label.slice(1).toLowerCase()}
      </Text>
    </Card>
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

const SIGNAL: Record<SignalKind, { tone: Tone; label: string; icon: IconName }> = {
  watch: { tone: 'warn', label: 'Watch', icon: 'priority-high' },
  good: { tone: 'up', label: 'Good', icon: 'trend-up' },
  context: { tone: 'signal', label: 'Context', icon: 'info-outline' },
};

/** A FadeInUp that takes the card's own style - the entrance used by list cards. */
export function FadeInUpCard({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <FadeInUp delay={delay} duration={320} distance={6} style={style}>
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

const humanize = (s: string) => {
  const t = s.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** A ranked, typed insight card - the core "signal" primitive, on Overview (preview) and Signals (full list). */
export function SignalCard({ kind, subtype, body, evidence, ctaLabel, onCta, entranceDelayMs = 0 }: SignalCardProps) {
  const { tone, label, icon } = SIGNAL[kind];
  const t = toneColors(tone);
  return (
    <FadeInUp delay={entranceDelayMs} duration={320} distance={6}>
      <Card style={{ padding: 15 }}>
        <View style={styles.row}>
          <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }}>
            <Icon name={icon} size={15} color={colors.onInk} />
          </View>
          <Text numberOfLines={1} style={[typography.cardTitle, { fontSize: 15, color: colors.text, marginLeft: 10, flex: 1 }]}>
            {humanize(subtype)}
          </Text>
          <MicroBadge label={label} tone={tone} ping={kind === 'watch'} />
        </View>
        <Text style={[typography.cardBody15, { color: colors.text, marginTop: 12 }]}>{body}</Text>
        {evidence || (ctaLabel && onCta) ? (
          <View style={[styles.evidence, { borderTopColor: colors.border }]}>
            {evidence ? <Text style={[typography.meta115, { color: colors.muted, flex: 1 }]}>{evidence}</Text> : <View style={{ flex: 1 }} />}
            {ctaLabel && onCta ? <TextActionLink label={ctaLabel} onPress={onCta} color={t.fg} icon="arrow-right" /> : null}
          </View>
        ) : null}
      </Card>
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

/** Recurring-payment rhythm strip (the dashboard's heartbeat bar): filled when paid, empty when skipped, dashed when upcoming. */
export function RegularityStrip({ states, color, startLabel, endLabel, centerLabel }: RegularityStripProps) {
  return (
    <View>
      <View style={styles.row}>
        {states.map((state, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              i > 0 && { marginLeft: 3 },
              state === 'paid' && { backgroundColor: color, opacity: 0.85 },
              state === 'skipped' && { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
              state === 'upcoming' && { borderWidth: 1.2, borderColor: color, borderStyle: 'dashed' },
            ]}
          />
        ))}
      </View>
      <View style={[styles.row, { justifyContent: 'space-between', marginTop: 7 }]}>
        {[startLabel, centerLabel, endLabel].map((label, i) => (
          <Text key={i} style={[typography.meta115, { color: colors.faint }]}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  deltaChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  microBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centerBlock: { alignItems: 'center', justifyContent: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  centerText: { textAlign: 'center' },
  barRow: { paddingVertical: 11, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 12 },
  evidence: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 11, borderTopWidth: 1 },
  segment: { flex: 1, height: 26, borderRadius: 4 },
});
