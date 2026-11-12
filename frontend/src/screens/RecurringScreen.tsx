import { ScrollView, Text, View } from 'react-native';
import { ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvatarChip } from '../components/Avatars';
import { ScreenBackHeader } from '../components/Controls';
import { EmptyState, ErrorRetry, FadeInUpCard, RegularityStrip, withAlpha } from '../components/Display';
import { Screen } from '../components/Screen';
import type { RecurringPaymentEntry, StatementAnalytics } from '../domain/types';
import { useCurrentPeriodAnalytics } from '../hooks/periods';
import { formatCurrency } from '../lib/format';
import { colors, hues } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

export interface RecurringSummary {
  payments: RecurringPaymentEntry[];
  /** Sum of each payment's monthly equivalent (a weekly ₹200 counts as ~₹870). */
  totalMonthly: number;
  /** % of an average month's spending the recurring payments take (F6: a monthly figure over a monthly figure). */
  shareOfOutflow: number;
  /** Mean regularity as a %. */
  avgRegularity: number;
}

export function summarizeRecurring(analytics: StatementAnalytics | undefined | null): RecurringSummary {
  const payments = [...(analytics?.recurringPayments ?? [])].sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost);
  const totalMonthly = payments.reduce((sum, p) => sum + p.estimatedMonthlyCost, 0);
  // Older stored analytics have no monthly average; the whole period's spend was the (wrong) denominator.
  const monthlySpend = analytics?.averageMonthlySpend || analytics?.totalSpend || 0;
  return {
    payments,
    totalMonthly,
    shareOfOutflow: monthlySpend === 0 ? 0 : (totalMonthly / monthlySpend) * 100,
    avgRegularity: payments.length === 0 ? 0 : (payments.reduce((s, p) => s + p.periodicityScore, 0) / payments.length) * 100,
  };
}

const CADENCE_LABEL: Record<RecurringPaymentEntry['cadence'], string> = {
  weekly: 'every week',
  fortnightly: 'every 2 weeks',
  monthly: 'every month',
  quarterly: 'every 3 months',
  yearly: 'every year',
};

/** "next in 4 days", "due today", "was due 3 days ago" - relative to `now`, in whole days. */
export function nextChargeLabel(next: Date | null, now: Date = new Date()): string | null {
  if (!next) return null;
  const days = Math.round((next.getTime() - now.getTime()) / 86_400_000);
  if (days === 0) return 'due today';
  if (days === 1) return 'next tomorrow';
  if (days > 1) return `next in ${days} days`;
  return null; // a past expectation from an old period says nothing useful
}

/** "+₹50 since last time" when the latest charge moved by 5% or more. */
export function priceChangeLabel(p: Pick<RecurringPaymentEntry, 'amountChange' | 'lastAmount'>): string | null {
  if (p.amountChange == null || Math.abs(p.amountChange) < 0.05) return null;
  const before = p.lastAmount / (1 + p.amountChange);
  const diff = p.lastAmount - before;
  return `${diff > 0 ? '+' : '−'}${formatCurrency(Math.abs(diff))} on the last charge`;
}

export default function RecurringScreen() {
  const insets = useSafeAreaInsets();
  const analytics = useCurrentPeriodAnalytics();

  if (analytics.isPending && analytics.fetchStatus !== 'idle') {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.signal} />
        </View>
      </Screen>
    );
  }
  if (analytics.isError) {
    return (
      <Screen>
        <ErrorRetry message="Could not load recurring payments." onRetry={() => void analytics.refetch()} />
      </Screen>
    );
  }

  const { payments, totalMonthly, shareOfOutflow, avgRegularity } = summarizeRecurring(analytics.data);

  return (
    <Screen safeTop={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom }}>
        <View style={{ backgroundColor: colors.bg, paddingHorizontal: spacing.gutter, paddingTop: insets.top + 6, paddingBottom: 26 }}>
          <ScreenBackHeader title="Recurring" />
          <Text style={[typography.microLabel11, { color: colors.faint, marginTop: 14 }]}>COMMITTED PER MONTH</Text>
          <Text style={[typography.heroAmount40, { color: colors.text, marginTop: 4 }]}>{formatCurrency(totalMonthly)}</Text>
          <View style={{ flexDirection: 'row', marginTop: 20 }}>
            <Stat label="DETECTED" value={`${payments.length}`} />
            <Stat label="OF MONTHLY SPEND" value={`${Math.round(shareOfOutflow)}%`} />
            <Stat label="AVG REGULARITY" value={`${Math.round(avgRegularity)}%`} color={colors.warn} />
          </View>
        </View>
        <View style={{ padding: spacing.gutter }}>
          {payments.length === 0 ? (
            <EmptyState icon="repeat" title="No recurring payments detected yet" subtitle="Miravelt looks for payees you pay on a steady cadence - weekly, monthly, quarterly or yearly - across all your statements." />
          ) : (
            payments.map((payment, i) => (
              <View key={payment.merchant} style={{ marginBottom: 12 }}>
                <SubscriptionCard payment={payment} entranceDelayMs={Math.min(6, i) * 50} />
              </View>
            ))
          )}
          <Text style={[typography.footnote12, { color: colors.faint, textAlign: 'center', marginTop: 8 }]}>
            Detected from payment regularity in your statements - no bank connection, no card access.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typography.microLabel11, { color: colors.faint }]}>{label}</Text>
      <Text style={[typography.amountMedium15, { color: color ?? colors.text, marginTop: 4 }]}>{value}</Text>
    </View>
  );
}

function SubscriptionCard({ payment, entranceDelayMs }: { payment: RecurringPaymentEntry; entranceDelayMs: number }) {
  const color = hues.violet;
  const filled = Math.round(Math.min(1, Math.max(0, payment.periodicityScore)) * 7);
  const states = Array.from({ length: 7 }, (_, i) => (i < filled ? ('paid' as const) : ('upcoming' as const)));
  const next = nextChargeLabel(payment.nextExpectedAt);
  const change = priceChangeLabel(payment);
  return (
    <FadeInUpCard delay={entranceDelayMs} style={{ padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AvatarChip initials={payment.merchant ? payment.merchant[0].toUpperCase() : '?'} size={40} radius={20} backgroundColor={withAlpha(color, 0.16)} foregroundColor={color} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[typography.rowLabel145, { color: colors.text }]}>{payment.merchant}</Text>
          <Text style={[typography.meta115, { color: colors.faint }]}>
            {formatCurrency(payment.typicalAmount)} {CADENCE_LABEL[payment.cadence]}
            {next ? ` · ${next}` : ''}
          </Text>
          {change ? (
            <Text style={[typography.meta115, { color: (payment.amountChange ?? 0) > 0 ? colors.warn : colors.signal }]}>{change}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.amountMedium16, { color: colors.text }]}>{formatCurrency(payment.estimatedMonthlyCost)}</Text>
          <Text style={[typography.microLabel11, { color: colors.faint }]}>a month</Text>
        </View>
      </View>
      <View style={{ height: 14 }} />
      <RegularityStrip states={states} color={color} startLabel="" endLabel="" centerLabel={`${Math.round(payment.periodicityScore * 100)}% REGULAR`} />
    </FadeInUpCard>
  );
}
