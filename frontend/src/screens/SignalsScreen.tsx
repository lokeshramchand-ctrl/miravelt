import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorRetry, SignalCard, signalKindFromSeverity, withAlpha } from '../components/Display';
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[typography.screenTitle24, { color: colors.onDark }]}>Signals</Text>
          {period ? (
            <Text style={[typography.microLabel11, { color: colors.onDarkFaint }]}>
              {`${monthAbbr(period.periodStart.getMonth() + 1)}–${monthAbbr(period.periodEnd.getMonth() + 1)} ${period.periodEnd.getFullYear()}`.toUpperCase()}
            </Text>
          ) : null}
        </View>
        <View style={{ height: 18 }} />
        {analytics.data ? <Headline analytics={analytics.data} /> : null}
        <View style={{ height: 18 }} />
        {insights.data ? (
          <View style={{ flexDirection: 'row' }}>
            <Chip label={`All ${all.length}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label={`Watch ${watchCount}`} selected={filter === 'watch'} onPress={() => setFilter('watch')} />
            <Chip label={`Good ${goodCount}`} selected={filter === 'good'} onPress={() => setFilter('good')} last />
          </View>
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
        <Text style={[typography.footnote1155, { color: colors.onDarkFaint, textAlign: 'center', marginTop: 8 }]}>
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
    <LinearGradient
      colors={[withAlpha(colors.accent, 0.14), 'rgba(0, 0, 0, 0)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ padding: 18, borderWidth: 1, borderColor: withAlpha(colors.accent, 0.28), borderRadius: 20 }}
    >
      <Text style={[typography.microLabelTracked105, { color: colors.accent }]}>THE HEADLINE</Text>
      <Text style={[typography.signalBody17, { color: colors.onDark, marginTop: 10 }]}>
        You spent <Text style={typography.amountMedium17}>{formatCurrency(analytics.totalSpend)}</Text> this period and kept <Text style={typography.amountMedium17}>{formatCurrency(analytics.totalIncome)}</Text> coming in.
        {count > 0 ? ` ${top} ${count > 1 ? 'are' : 'is'} ${share}% of your spending.` : ''}
      </Text>
    </LinearGradient>
  );
}

function Chip({ label, selected, onPress, last = false }: { label: string; selected: boolean; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ paddingHorizontal: 13, paddingVertical: 8, marginRight: last ? 0 : 8, backgroundColor: selected ? colors.ink700 : 'transparent', borderWidth: 1, borderColor: colors.hairlineDark, borderRadius: radius.pill }}
    >
      <Text style={[typography.buttonLabel12, { color: selected ? colors.onDark : colors.onDarkMuted }]}>{label}</Text>
    </Pressable>
  );
}
