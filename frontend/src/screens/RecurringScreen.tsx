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
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

export interface RecurringSummary {
  payments: RecurringPaymentEntry[];
  totalMonthly: number;
  /** % of the period's outflow the recurring payments make up. */
  shareOfOutflow: number;
  /** Mean periodicity score as a %. */
  avgRegularity: number;
}

export function summarizeRecurring(analytics: StatementAnalytics | undefined | null): RecurringSummary {
  const payments = [...(analytics?.recurringPayments ?? [])].sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost);
  const totalMonthly = payments.reduce((sum, p) => sum + p.estimatedMonthlyCost, 0);
  return {
    payments,
    totalMonthly,
    shareOfOutflow: !analytics || analytics.totalSpend === 0 ? 0 : (totalMonthly / analytics.totalSpend) * 100,
    avgRegularity: payments.length === 0 ? 0 : (payments.reduce((s, p) => s + p.periodicityScore, 0) / payments.length) * 100,
  };
}

export default function RecurringScreen() {
  const insets = useSafeAreaInsets();
  const analytics = useCurrentPeriodAnalytics();

  if (analytics.isPending && analytics.fetchStatus !== 'idle') {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
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
        <View style={{ backgroundColor: colors.ink900, paddingHorizontal: spacing.gutter, paddingTop: insets.top + 6, paddingBottom: 26 }}>
          <ScreenBackHeader title="Recurring" />
          <Text style={[typography.microLabel11, { color: colors.onDarkFaint, marginTop: 14 }]}>COMMITTED EVERY MONTH</Text>
          <Text style={[typography.heroAmount40, { color: colors.onDark, marginTop: 4 }]}>{formatCurrency(totalMonthly)}</Text>
          <View style={{ flexDirection: 'row', marginTop: 20 }}>
            <Stat label="DETECTED" value={`${payments.length}`} />
            <Stat label="SHARE OF OUTFLOW" value={`${Math.round(shareOfOutflow)}%`} />
            <Stat label="AVG REGULARITY" value={`${Math.round(avgRegularity)}%`} color={colors.amber} />
          </View>
        </View>
        <View style={{ padding: spacing.gutter }}>
          {payments.length === 0 ? (
            <EmptyState icon="repeat" title="No recurring payments detected yet" subtitle="Miravelt looks for merchants you pay on a regular cadence within this period." />
          ) : (
            payments.map((payment, i) => (
              <View key={payment.merchant} style={{ marginBottom: 12 }}>
                <SubscriptionCard payment={payment} entranceDelayMs={Math.min(6, i) * 50} />
              </View>
            ))
          )}
          <Text style={[typography.footnote12, { color: colors.onLightFaint, textAlign: 'center', marginTop: 8 }]}>
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
      <Text style={[typography.microLabel11, { color: colors.onDarkFaint }]}>{label}</Text>
      <Text style={[typography.amountMedium15, { color: color ?? colors.onDark, marginTop: 4 }]}>{value}</Text>
    </View>
  );
}

function SubscriptionCard({ payment, entranceDelayMs }: { payment: RecurringPaymentEntry; entranceDelayMs: number }) {
  const color = colors.violet;
  const filled = Math.round(Math.min(1, Math.max(0, payment.periodicityScore)) * 7);
  const states = Array.from({ length: 7 }, (_, i) => (i < filled ? ('paid' as const) : ('upcoming' as const)));
  return (
    <FadeInUpCard delay={entranceDelayMs} style={{ padding: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairlineLight, borderRadius: radius.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AvatarChip initials={payment.merchant ? payment.merchant[0].toUpperCase() : '?'} size={40} radius={12} backgroundColor={withAlpha(color, 0.16)} foregroundColor={color} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[typography.rowLabel145, { color: colors.onLight }]}>{payment.merchant}</Text>
          <Text style={[typography.meta115, { color: colors.onLightFaint }]}>{payment.occurrences} occurrences this period</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.amountMedium16, { color: colors.onLight }]}>{formatCurrency(payment.estimatedMonthlyCost)}</Text>
          <Text style={[typography.microLabel11, { color: colors.onLightFaint }]}>per month</Text>
        </View>
      </View>
      <View style={{ height: 14 }} />
      <RegularityStrip states={states} color={color} startLabel="" endLabel="" centerLabel={`${Math.round(payment.periodicityScore * 100)}% REGULAR`} />
    </FadeInUpCard>
  );
}
