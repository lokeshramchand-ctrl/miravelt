import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { statementsRepository } from '../api/instance';
import { AvatarChip } from '../components/Avatars';
import { MiniBarChart } from '../components/Charts';
import { ScreenBackHeader } from '../components/Controls';
import { DeltaChip, EmptyState, ErrorRetry, withAlpha } from '../components/Display';
import { Screen } from '../components/Screen';
import { SkeletonListRow } from '../components/Skeleton';
import type { Statement, Transaction } from '../domain/types';
import { useCurrentPeriod, useCurrentPeriodAnalytics, usePreviousPeriodAnalytics } from '../hooks/periods';
import { formatCompactCurrency, formatCurrency, formatPeriodRange, monthAbbr } from '../lib/format';
import { categoryColor, colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

export interface MerchantAggregate {
  merchant: string;
  count: number;
  total: number;
  average: number;
}
export interface MonthlyBucket {
  year: number;
  /** 1-12 */
  month: number;
  total: number;
}
export interface CategoryDrilldown {
  merchants: MerchantAggregate[];
  monthlyBuckets: MonthlyBucket[];
}

/** Rolls a category's transactions up into merchant totals (largest first) and one bucket per month of the period. */
export function aggregateCategory(transactions: Transaction[], period: Pick<Statement, 'periodStart' | 'periodEnd'>): CategoryDrilldown {
  const merchantTotals = new Map<string, { count: number; total: number }>();
  const monthlyTotals = new Map<string, number>();
  for (const txn of transactions) {
    const name = txn.merchant ?? 'Unknown merchant';
    const existing = merchantTotals.get(name);
    merchantTotals.set(name, { count: (existing?.count ?? 0) + 1, total: (existing?.total ?? 0) + txn.amount });
    const key = `${txn.timestamp.getFullYear()}-${txn.timestamp.getMonth() + 1}`;
    monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + txn.amount);
  }

  const merchants = [...merchantTotals.entries()]
    .map(([merchant, v]) => ({ merchant, count: v.count, total: v.total, average: v.count === 0 ? 0 : v.total / v.count }))
    .sort((a, b) => b.total - a.total);

  const monthlyBuckets: MonthlyBucket[] = [];
  let year = period.periodStart.getFullYear();
  let month = period.periodStart.getMonth() + 1;
  const endYear = period.periodEnd.getFullYear();
  const endMonth = period.periodEnd.getMonth() + 1;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    monthlyBuckets.push({ year, month, total: monthlyTotals.get(`${year}-${month}`) ?? 0 });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return { merchants, monthlyBuckets };
}

/**
 * Aggregates a category's merchants and monthly spend client-side from
 * `/statements/{id}/transactions?category=...` - there's no per-category
 * merchant/monthly endpoint, so this derives it from the same real transaction
 * records Activity uses. Capped at 3 pages (300 txns) as a sane bound for a
 * single category within one statement. `gcTime: 0` because this is keyed per
 * category: every category the user drills into would otherwise stay cached.
 */
function useCategoryDrilldown(category: string) {
  const period = useCurrentPeriod();
  return useQuery({
    queryKey: ['drilldown', period?.id ?? null, category],
    enabled: period != null,
    gcTime: 0,
    staleTime: 0,
    queryFn: async (): Promise<CategoryDrilldown> => {
      const transactions: Transaction[] = [];
      const maxPages = 3;
      for (let page = 1; page <= maxPages; page++) {
        const result = await statementsRepository.transactions(period!.id, { page, pageSize: 100, category, transactionType: 'DEBIT', sortBy: 'timestamp', sortOrder: 'desc' });
        transactions.push(...result.items);
        if (page >= result.totalPages) break;
      }
      return aggregateCategory(transactions, period!);
    },
  });
}

export default function CategoryDrilldownScreen() {
  const { category: raw } = useLocalSearchParams<{ category: string }>();
  const category = safeDecode(raw ?? '');
  const period = useCurrentPeriod();
  const analytics = useCurrentPeriodAnalytics();
  const previous = usePreviousPeriodAnalytics();
  const drilldown = useCategoryDrilldown(category);
  const color = categoryColor(category);

  const total = analytics.data?.categoryBreakdown.find((e) => e.category === category)?.totalAmount ?? 0;
  const previousEntry = previous.data?.categoryBreakdown.find((e) => e.category === category);
  const delta = previousEntry && previousEntry.totalAmount > 0 ? ((total - previousEntry.totalAmount) / previousEntry.totalAmount) * 100 : null;

  return (
    <Screen safeTop={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <HeaderBand>
          <ScreenBackHeader centerTitle={period ? formatPeriodRange(period.periodStart, period.periodEnd) : ''} />
          <View style={{ height: 6 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
            <Text style={[typography.navTitle15, { color: colors.onDark, marginLeft: 8 }]}>{category}</Text>
          </View>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[typography.heroAmount36, { color: colors.onDark }]}>{formatCurrency(total)}</Text>
            {delta != null ? (
              <View style={{ marginLeft: 10 }}>
                <DeltaChip label={`${delta >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(delta))}%`} up={delta >= 0} tint={withAlpha(delta >= 0 ? colors.rose : colors.accent, 0.16)} foreground={delta >= 0 ? colors.rose : colors.accent} />
              </View>
            ) : null}
          </View>
          <View style={{ height: 20 }} />
          {drilldown.data ? <Chart buckets={drilldown.data.monthlyBuckets} /> : <View style={{ height: 78 }} />}
        </HeaderBand>

        <View style={{ padding: spacing.gutter }}>
          <Text style={[typography.microLabelTracked11, { color: colors.onLightFaint }]}>MERCHANTS IN {category.toUpperCase()}</Text>
          <View style={{ height: 12 }} />
          {drilldown.isPending ? (
            <View>
              {[0, 1, 2].map((i) => (
                <View key={i}>
                  <SkeletonListRow />
                  {i !== 2 ? <View style={{ height: 1, marginLeft: 62, backgroundColor: colors.hairlineLight }} /> : null}
                </View>
              ))}
            </View>
          ) : drilldown.isError ? (
            <ErrorRetry message="Could not load merchants." onRetry={() => void drilldown.refetch()} />
          ) : drilldown.data.merchants.length === 0 ? (
            <EmptyState icon="receipt" title="No transactions found for this category yet" />
          ) : (
            <MerchantList merchants={drilldown.data.merchants.slice(0, 5)} color={color} />
          )}
          <View style={{ height: 16 }} />
          {drilldown.data && drilldown.data.merchants.length > 0 && total > 0 ? <TopMerchantNote merchant={drilldown.data.merchants[0]} total={total} category={category} /> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The dark header band paints under the status bar, so it carries the top inset itself. */
function HeaderBand({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={{ backgroundColor: colors.ink900, paddingHorizontal: spacing.gutter, paddingTop: insets.top + 6, paddingBottom: 24 }}>{children}</View>;
}

function Chart({ buckets }: { buckets: MonthlyBucket[] }) {
  const max = buckets.reduce((m, b) => (b.total > m ? b.total : m), 0);
  return (
    <MiniBarChart
      entries={buckets.map((b, i) => {
        const last = i === buckets.length - 1;
        return {
          label: monthAbbr(b.month),
          heightFraction: max === 0 ? 0.02 : Math.min(1, Math.max(0.02, b.total / max)),
          highlighted: last,
          tooltip: last ? formatCompactCurrency(b.total) : undefined,
        };
      })}
    />
  );
}

function MerchantList({ merchants, color }: { merchants: MerchantAggregate[]; color: string }) {
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairlineLight, borderRadius: radius.card }}>
      {merchants.map((m, i) => (
        <View key={m.merchant}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 }}>
            <AvatarChip initials={m.merchant ? m.merchant[0].toUpperCase() : '?'} size={36} radius={11} backgroundColor={withAlpha(color, 0.16)} foregroundColor={color} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.rowLabel14, { color: colors.onLight }]}>{m.merchant}</Text>
              <Text style={[typography.meta115, { color: colors.onLightFaint }]}>
                {m.count} order{m.count === 1 ? '' : 's'} · {formatCurrency(m.average)} avg
              </Text>
            </View>
            <Text style={[typography.amountMedium14, { color: colors.onLight }]}>{formatCurrency(m.total)}</Text>
          </View>
          {i !== merchants.length - 1 ? <View style={{ height: 1, marginLeft: 62, backgroundColor: colors.hairlineLight }} /> : null}
        </View>
      ))}
    </View>
  );
}

function TopMerchantNote({ merchant, total, category }: { merchant: MerchantAggregate; total: number; category: string }) {
  const share = Math.round((merchant.total / total) * 100);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairlineLight, borderRadius: radius.card }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 11, color: colors.accentInk }}>✦</Text>
      </View>
      <Text style={[typography.cardBody135, { color: colors.onLight, flex: 1, marginLeft: 10 }]}>
        {merchant.merchant} accounts for {share}% of your {category} spend this period.
      </Text>
    </View>
  );
}
