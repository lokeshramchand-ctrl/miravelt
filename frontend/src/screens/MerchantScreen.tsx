import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { timelineRepository } from '../api/instance';
import { ApiHttpException } from '../api/errors';
import { AvatarChip } from '../components/Avatars';
import { ScreenBackHeader } from '../components/Controls';
import { EmptyState, ErrorRetry, withAlpha } from '../components/Display';
import { Screen } from '../components/Screen';
import type { MerchantPage } from '../domain/types';
import { formatCompactCurrency, formatCurrency, formatPeriodRange, monthAbbr } from '../lib/format';
import { categoryColor, colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { nextChargeLabel } from './RecurringScreen';

const CADENCE_WORD = { weekly: 'Weekly', fortnightly: 'Every 2 weeks', monthly: 'Monthly', quarterly: 'Every 3 months', yearly: 'Yearly' } as const;

/** What Miravelt's memory of this payee means, in the user's words. */
export function memoryLabel(page: Pick<MerchantPage, 'memoryState' | 'categorySource'>): string | null {
  if (page.categorySource === 'user') {
    return page.memoryState === 'PERMANENT' ? 'You taught Miravelt this one, and it has held across your statements.' : 'You taught Miravelt this one. It is remembered for future statements.';
  }
  return null;
}

/** "2026-03" -> "Mar". */
export function monthLabel(month: string): string {
  const m = Number(month.split('-')[1]);
  return m >= 1 && m <= 12 ? monthAbbr(m) : month;
}

/** One merchant across every period (PROJECT_AUDIT.md D8): total, average, cadence and a month-by-month bar chart. */
export default function MerchantScreen() {
  const insets = useSafeAreaInsets();
  const { name } = useLocalSearchParams<{ name: string }>();
  const merchant = Array.isArray(name) ? name[0] : name;
  const page = useQuery({ queryKey: ['merchant', merchant], enabled: !!merchant, queryFn: () => timelineRepository.merchantPage(merchant!) });

  if (page.isPending) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.signal} />
        </View>
      </Screen>
    );
  }
  if (page.isError) {
    const missing = page.error instanceof ApiHttpException && page.error.statusCode === 404;
    return (
      <Screen>
        <View style={{ paddingHorizontal: spacing.gutter, paddingTop: 6 }}>
          <ScreenBackHeader title={merchant ?? 'Merchant'} />
        </View>
        {missing ? (
          <View style={{ marginTop: 60 }}>
            <EmptyState icon="storefront" title="No payments to this merchant" subtitle="It may have been renamed by a correction, or its period was removed." />
          </View>
        ) : (
          <ErrorRetry message="Could not load this merchant." onRetry={() => void page.refetch()} />
        )}
      </Screen>
    );
  }

  const data = page.data;
  const color = categoryColor(data.category ?? '');
  const peak = Math.max(1, ...data.monthly.map((m) => m.totalAmount));
  const next = nextChargeLabel(data.nextExpectedAt);
  const memory = memoryLabel(data);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: 6, paddingBottom: 28 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <ScreenBackHeader title="Merchant" />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
          <AvatarChip initials={data.merchant ? data.merchant[0].toUpperCase() : '?'} size={52} radius={16} backgroundColor={withAlpha(color, 0.16)} foregroundColor={color} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[typography.bigHeadline22, { color: colors.text }]}>{data.merchant}</Text>
            <Text style={[typography.meta12, { color: colors.faint, marginTop: 3 }]}>
              {data.category ?? 'Uncategorized'} · {formatPeriodRange(data.firstAt, data.lastAt)}
            </Text>
          </View>
        </View>

        <Text style={[typography.microLabel11, { color: colors.faint, marginTop: 22 }]}>TOTAL SPENT</Text>
        <Text style={[typography.heroAmount40, { color: colors.text, marginTop: 4 }]}>{formatCurrency(data.totalSpent)}</Text>
        <View style={{ flexDirection: 'row', marginTop: 18 }}>
          <Fact label="PAYMENTS" value={`${data.paymentCount}`} />
          <Fact label="AVERAGE" value={formatCurrency(data.averagePayment)} />
          <Fact label="RHYTHM" value={data.cadence ? CADENCE_WORD[data.cadence] : 'No pattern'} />
        </View>

        {data.cadence && data.typicalAmount != null ? (
          <View style={{ marginTop: 18, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card }}>
            <Text style={[typography.footnote12, { color: colors.muted }]}>
              Usually {formatCurrency(data.typicalAmount)} each time{next ? ` · ${next}` : ''}.
            </Text>
          </View>
        ) : null}

        {data.monthly.length > 0 ? (
          <>
            <Text style={[typography.microLabel11, { color: colors.faint, marginTop: 24 }]}>BY MONTH</Text>
            <View
              accessible
              accessibilityLabel={`Spending by month: ${data.monthly.map((m) => `${monthLabel(m.month)} ${formatCurrency(m.totalAmount)}`).join(', ')}`}
              style={{ flexDirection: 'row', alignItems: 'flex-end', height: 132, marginTop: 12 }}
            >
              {data.monthly.slice(-12).map((m) => (
                <View key={m.month} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <Text style={[typography.microLabel11, { color: colors.faint, marginBottom: 4 }]} numberOfLines={1}>
                    {formatCompactCurrency(m.totalAmount)}
                  </Text>
                  <View style={{ width: '62%', height: Math.max(3, (m.totalAmount / peak) * 84), borderRadius: 5, backgroundColor: color }} />
                  <Text style={[typography.microLabel11, { color: colors.muted, marginTop: 6 }]}>{monthLabel(m.month)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {data.payeeNames.length > 0 ? (
          <>
            <Text style={[typography.microLabel11, { color: colors.faint, marginTop: 24 }]}>PRINTED ON YOUR STATEMENTS AS</Text>
            <Text style={[typography.body13, { color: colors.muted, marginTop: 8 }]}>{data.payeeNames.join(' · ')}</Text>
          </>
        ) : null}

        {memory ? <Text style={[typography.footnote12, { color: colors.signalText, marginTop: 20 }]}>{memory}</Text> : null}
        {data.totalReceived > 0 ? (
          <Text style={[typography.footnote12, { color: colors.muted, marginTop: 12 }]}>You also received {formatCurrency(data.totalReceived)} from this payee.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typography.microLabel11, { color: colors.faint }]}>{label}</Text>
      <Text style={[typography.amountMedium15, { color: colors.text, marginTop: 4 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
