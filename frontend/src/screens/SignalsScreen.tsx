import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SegmentedControl } from '../components/Controls';
import { EmptyState, ErrorRetry, SignalCard, signalKindFromSeverity } from '../components/Display';
import { Icon } from '../components/Icon';
import { FadeInUp } from '../components/motion';
import { Screen } from '../components/Screen';
import { SkeletonBox } from '../components/Skeleton';
import { spendingBreakdown } from '../domain/types';
import type { Insight, StatementAnalytics } from '../domain/types';
import { useCurrentPeriod, useCurrentPeriodAnalytics, useCurrentPeriodInsights } from '../hooks/periods';
import { formatCurrency, monthAbbr } from '../lib/format';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

type SignalFilter = 'all' | 'watch' | 'good';

export function filterInsights(insights: Insight[], filter: SignalFilter): Insight[] {
  switch (filter) {
    case 'watch':
      return insights.filter((i) => i.severity === 'WARNING');
    case 'good':
      return insights.filter((i) => i.severity === 'POSITIVE');
    default:
      return insights;
  }
}

/** "Food and Travel are 62% of your spending." - the share is of total spend, over the top two categories. */
export function headlineSpendShare(analytics: StatementAnalytics): { top: string; share: number; count: number } {
  const sorted = [...spendingBreakdown(analytics)].sort((a, b) => b.totalAmount - a.totalAmount);
  const topTwo = sorted.slice(0, 2);
  const share = analytics.totalSpend === 0 ? 0 : Math.round((topTwo.reduce((m, e) => m + e.totalAmount, 0) / analytics.totalSpend) * 100);
  return { top: topTwo.map((e) => e.category).join(' and '), share, count: sorted.length };
}

export default function SignalsScreen() {
  const insets = useSafeAreaInsets();
  const period = useCurrentPeriod();
  const analytics = useCurrentPeriodAnalytics();
  const insights = useCurrentPeriodInsights();
  const [filter, setFilter] = useState<SignalFilter>('all');

  const all = insights.data ?? [];
  const watchCount = all.filter((i) => i.severity === 'WARNING').length;
  const goodCount = all.filter((i) => i.severity === 'POSITIVE').length;

  return (
    <Screen dark>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: 6, paddingBottom: spacing.navClearance + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Text style={[typography.footnote12, { color: colors.muted, marginTop: 14 }]}>
          {period ? `What stood out · ${monthAbbr(period.periodStart.getMonth() + 1)}–${monthAbbr(period.periodEnd.getMonth() + 1)} ${period.periodEnd.getFullYear()}` : 'What stood out'}
        </Text>
        <Text style={[typography.pageTitle, { color: colors.text, marginTop: 4 }]}>Signals</Text>
        <View style={{ height: 18 }} />
        {analytics.data ? <Headline analytics={analytics.data} /> : null}
        <View style={{ height: 18 }} />
        {insights.data ? (
          <SegmentedControl<SignalFilter>
            options={[['all', 'All'], ['watch', 'Watch'], ['good', 'Good']]}
            counts={{ all: all.length, watch: watchCount, good: goodCount }}
            value={filter}
            onChange={setFilter}
          />
        ) : null}
        <View style={{ height: 16 }} />
        {insights.isPending ? (
          <View>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ marginBottom: i === 2 ? 0 : 12 }}>
                <SkeletonBox width="100%" height={96} radius={16} dark />
              </View>
            ))}
          </View>
        ) : insights.isError ? (
          <ErrorRetry dark message="Could not load signals." onRetry={() => void insights.refetch()} />
        ) : (
          <SignalList insights={filterInsights(all, filter)} />
        )}
        <Text style={[typography.footnote1155, { color: colors.faint, textAlign: 'center', marginTop: 8 }]}>
          Signals are written from your computed analytics only. If a figure isn't in your statement, Miravelt won't claim it.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function SignalList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <EmptyState dark icon="auto-awesome" title="No signals in this filter yet" subtitle="Switch filters or check back after your next statement." />;
  }
  return (
    <View>
      {insights.map((insight, i) => {
        const recurring = insight.type.toUpperCase().includes('RECUR');
        return (
          <View key={`${insight.type}-${i}`} style={{ marginBottom: 12 }}>
            <SignalCard
              kind={signalKindFromSeverity(insight.severity)}
              subtype={insight.type.toUpperCase()}
              body={insight.message}
              dark
              entranceDelayMs={i * 60}
              ctaLabel={recurring ? 'Open' : undefined}
              onCta={recurring ? () => router.push('/recurring') : undefined}
            />
          </View>
        );
      })}
    </View>
  );
}

function Headline({ analytics }: { analytics: StatementAnalytics }) {
  const { top, share, count } = headlineSpendShare(analytics);
  return (
    <FadeInUp>
      <View style={{ padding: 20, borderRadius: radius.card, backgroundColor: colors.heroBg, borderWidth: 1, borderColor: colors.scheme === 'dark' ? colors.border2 : colors.heroBg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[typography.footnote12, { color: colors.heroMuted, flex: 1 }]}>The headline</Text>
          <Icon name="arrow-up-right" size={16} color={colors.heroText} />
        </View>
        <Text style={[typography.signalBody17, { fontFamily: 'Inter_400Regular', fontSize: 19, lineHeight: 27, color: colors.heroText, marginTop: 12 }]}>
          You spent <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{formatCurrency(analytics.totalSpend)}</Text> this period and kept{' '}
          <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{formatCurrency(analytics.totalIncome)}</Text> coming in.
          {count > 0 ? ` ${top} ${count > 1 ? 'are' : 'is'} ${share}% of your spending.` : ''}
        </Text>
        {count > 0 ? (
          <View style={{ flexDirection: 'row', marginTop: 16 }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.heroBorder }}>
              <Text style={[typography.meta12, { color: colors.heroText }]}>{share}% in two categories</Text>
            </View>
          </View>
        ) : null}
      </View>
    </FadeInUp>
  );
}
