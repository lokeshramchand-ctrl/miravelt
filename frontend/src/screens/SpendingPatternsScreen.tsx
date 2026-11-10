import { useQuery } from '@tanstack/react-query';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyticsRepository } from '../api/instance';
import { AvatarChip } from '../components/Avatars';
import { ScreenBackHeader } from '../components/Controls';
import { CategoryBarRow, DeltaChip, EmptyState, ErrorRetry, SectionHeader, withAlpha } from '../components/Display';
import { Screen } from '../components/Screen';
import { SkeletonBox } from '../components/Skeleton';
import type { MoMTrend } from '../domain/types';
import { formatCurrency, formatDayMonth } from '../lib/format';
import { categoryColor, colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

// These are per-view and cheap, so they refetch each time the screen opens.
const fresh = { staleTime: 0, gcTime: 0 } as const;

export default function SpendingPatternsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: 6, paddingBottom: 28 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <ScreenBackHeader title="Spending patterns" titleStyle={typography.navTitle15} dark={false} />
        <View style={{ height: 20 }} />
        <MoMTrendCard />
        <View style={{ height: 26 }} />
        <CategoryPatternsSection />
        <View style={{ height: 26 }} />
        <MerchantPatternsSection />
        <View style={{ height: 26 }} />
        <SubscriptionsSection />
      </ScrollView>
    </Screen>
  );
}

const card = { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairlineLight, borderRadius: radius.card } as const;

/**
 * This endpoint compares calendar months, not uploaded periods - with no
 * transactions in either month there is no trend to show, and a green "▼ 0%"
 * would read as spending having dropped.
 */
export function hasNoMoMData(mom: Pick<MoMTrend, 'currentSpend' | 'previousSpend'>): boolean {
  return mom.currentSpend === 0 && mom.previousSpend === 0;
}

function MoMTrendCard() {
  const query = useQuery({ queryKey: ['patterns', 'mom'], queryFn: () => analyticsRepository.trendsMoM(), ...fresh });
  if (query.isPending) return <SkeletonBox width="100%" height={96} radius={16} />;
  if (query.isError) return <ErrorRetry message="Could not load month-over-month trend." onRetry={() => void query.refetch()} />;
  const mom = query.data;
  const up = mom.trend === 'up';
  return (
    <View style={[card, { padding: 17 }]}>
      <Text style={[typography.microLabelTracked11, { color: colors.onLightFaint }]}>MONTH OVER MONTH</Text>
      {hasNoMoMData(mom) ? (
        <Text style={[typography.footnote12, { color: colors.onLightMuted, marginTop: 10 }]}>
          No spending recorded this calendar month or last. Month-over-month compares calendar months, so it fills in once a statement covers them.
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <Text style={[typography.heroAmount34, { color: colors.onLight }]}>{formatCurrency(mom.currentSpend)}</Text>
            <View style={{ marginLeft: 10 }}>
              <DeltaChip label={`${up ? '▲' : '▼'} ${Math.abs(Math.round(mom.momGrowthPercentage))}%`} up={up} tint={withAlpha(up ? colors.rose : colors.accent, 0.16)} foreground={up ? colors.rose : colors.accent} />
            </View>
          </View>
          <Text style={[typography.footnote12, { color: colors.onLightMuted, marginTop: 6 }]}>vs {formatCurrency(mom.previousSpend)} last period</Text>
        </>
      )}
    </View>
  );
}

function CategoryPatternsSection() {
  const query = useQuery({ queryKey: ['patterns', 'categories'], queryFn: () => analyticsRepository.categoryPatterns(), ...fresh });
  return (
    <View>
      <SectionHeader label="CATEGORY PATTERNS (30D)" labelColor={colors.onLightFaint} />
      <View style={{ height: 4 }} />
      {query.isPending ? (
        [0, 1, 2].map((i) => (
          <View key={i} style={{ marginBottom: i === 2 ? 0 : 12 }}>
            <SkeletonBox width="100%" height={34} />
          </View>
        ))
      ) : query.isError ? (
        <ErrorRetry message="Could not load category patterns." onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState icon="donut-small" title="No category patterns yet" />
      ) : (
        <CategoryBars entries={query.data} />
      )}
    </View>
  );
}

function CategoryBars({ entries }: { entries: { category: string; totalAmount: number }[] }) {
  const sorted = [...entries].sort((a, b) => b.totalAmount - a.totalAmount);
  const maxAmount = sorted[0].totalAmount === 0 ? 1 : sorted[0].totalAmount;
  const total = sorted.reduce((sum, e) => sum + e.totalAmount, 0);
  return (
    <View>
      {sorted.map((entry) => (
        <CategoryBarRow
          key={entry.category}
          name={entry.category}
          amountLabel={formatCurrency(entry.totalAmount)}
          percentOfTotal={total === 0 ? 0 : Math.round((entry.totalAmount / total) * 100)}
          relativeWidthFraction={entry.totalAmount / maxAmount}
          color={categoryColor(entry.category)}
        />
      ))}
    </View>
  );
}

function MerchantPatternsSection() {
  const query = useQuery({ queryKey: ['patterns', 'merchants'], queryFn: () => analyticsRepository.merchantPatterns(8), ...fresh });
  return (
    <View>
      <SectionHeader label="TOP MERCHANTS" labelColor={colors.onLightFaint} />
      <View style={{ height: 12 }} />
      {query.isPending ? (
        <SkeletonBox width="100%" height={140} radius={16} />
      ) : query.isError ? (
        <ErrorRetry message="Could not load top merchants." onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState icon="storefront" title="No merchant patterns yet" />
      ) : (
        <View style={card}>
          {query.data.map((entry, i) => (
            <View key={`${entry.merchant}-${i}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 }}>
                <AvatarChip initials={entry.merchant ? entry.merchant[0].toUpperCase() : '?'} size={36} radius={11} backgroundColor={colors.accentTint} foregroundColor={colors.accentInk} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[typography.rowLabel14, { color: colors.onLight }]}>{entry.merchant ?? 'Unknown'}</Text>
                  <Text style={[typography.meta115, { color: colors.onLightFaint }]}>
                    {entry.visits} visit{entry.visits === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={[typography.amountMedium14, { color: colors.onLight }]}>{formatCurrency(entry.spent)}</Text>
              </View>
              {i !== query.data.length - 1 ? <View style={{ height: 1, marginLeft: 62, backgroundColor: colors.hairlineLight }} /> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function SubscriptionsSection() {
  const query = useQuery({ queryKey: ['patterns', 'subscriptions'], queryFn: () => analyticsRepository.subscriptions(), ...fresh });
  return (
    <View>
      {query.data ? (
        <SectionHeader label="SUBSCRIPTIONS" labelColor={colors.onLightFaint} trailing={<Text style={[typography.body14, { fontSize: 12, color: colors.onLightFaint }]}>{formatCurrency(query.data.totalMonthlyBurn)}/mo</Text>} />
      ) : null}
      <View style={{ height: 12 }} />
      {query.isPending ? (
        <SkeletonBox width="100%" height={96} radius={16} />
      ) : query.isError ? (
        <ErrorRetry message="Could not load subscriptions." onRetry={() => void query.refetch()} />
      ) : query.data.details.length === 0 ? (
        <EmptyState icon="autorenew" title="No recurring subscriptions detected" />
      ) : (
        <View style={card}>
          {query.data.details.map((detail, i) => (
            <View key={`${detail.merchant}-${i}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.rowLabel14, { color: colors.onLight }]}>{detail.merchant}</Text>
                  {detail.lastBilled ? <Text style={[typography.meta115, { color: colors.onLightFaint }]}>Last billed {formatDayMonth(detail.lastBilled)}</Text> : null}
                </View>
                <Text style={[typography.amountMedium14, { color: colors.onLight }]}>{formatCurrency(detail.estimatedMonthlyCost)}/mo</Text>
              </View>
              {i !== query.data.details.length - 1 ? <View style={{ height: 1, marginLeft: 14, backgroundColor: colors.hairlineLight }} /> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
