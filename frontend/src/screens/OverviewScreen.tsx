import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PrimaryPillButton, TextActionLink } from '../components/Buttons';
import { UserAvatar } from '../components/Avatars';
import { PeriodPill } from '../components/Controls';
import { CategoryBarRow, DeltaChip, EmptyState, ErrorRetry, SectionHeader, SignalCard, signalKindFromSeverity, withAlpha } from '../components/Display';
import { Screen } from '../components/Screen';
import { SkeletonBox } from '../components/Skeleton';
import type { CategoryBreakdownEntry, Statement, StatementAnalytics } from '../domain/types';
import { spendingBreakdown, userInitials } from '../domain/types';
import {
  invalidatePeriods,
  markPeriodViewedOnce,
  useCurrentPeriod,
  useCurrentPeriodAnalytics,
  useCurrentPeriodInsights,
  useJobPoll,
  usePeriods,
  usePreviousPeriodAnalytics,
} from '../hooks/periods';
import { formatCurrency, formatPeriodRange } from '../lib/format';
import { alertUnusualSpendIfEnabled } from '../lib/unusualSpend';
import { queryClient } from '../lib/queryClient';
import { useAuth } from '../state/auth';
import { useSheets } from '../state/sheets';
import { categoryColor, colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The share-of-spend line under a category: how it moved against the previous period (only when both periods have the category). */
export function trendCaption(category: string, current: number, previous: CategoryBreakdownEntry[] | undefined): string | null {
  if (!previous) return null;
  const match = previous.find((e) => e.category === category);
  if (!match || match.totalAmount === 0) return null;
  const delta = ((current - match.totalAmount) / match.totalAmount) * 100;
  return `${delta <= 0 ? '↓' : '↑'} ${Math.abs(Math.round(delta))}% vs previous period`;
}

/**
 * The hero chip: how outflow trended, not raw net. rose+▲ means you're further
 * in the red than last period, accent+▼ means it improved - matches the mock's
 * "▲12%" rose chip next to a negative net-flow hero.
 */
export function netFlowDeltaPercent(current: StatementAnalytics, previous: StatementAnalytics | undefined): number | null {
  if (!previous) return null;
  const net = current.totalIncome - current.totalSpend;
  const prevNet = previous.totalIncome - previous.totalSpend;
  return prevNet === 0 ? null : ((prevNet - net) / Math.abs(prevNet)) * 100;
}

function spanLabel(period: Statement): string {
  const months = (period.periodEnd.getFullYear() - period.periodStart.getFullYear()) * 12 + (period.periodEnd.getMonth() - period.periodStart.getMonth()) + 1;
  return months <= 1 ? '1 MONTH' : `${months} MONTHS`;
}

export default function OverviewScreen() {
  const periods = usePeriods();
  const current = useCurrentPeriod();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const completedId = current?.processingStatus === 'COMPLETED' ? current.id : null;
  useEffect(() => {
    if (completedId) markPeriodViewedOnce(completedId);
  }, [completedId]);

  const refresh = async () => {
    setRefreshing(true);
    await invalidatePeriods();
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['analytics'] }), queryClient.invalidateQueries({ queryKey: ['insights'] })]);
    setRefreshing(false);
  };

  if (periods.isPending) return <OverviewSkeleton />;
  if (periods.isError) {
    return (
      <Screen>
        <ErrorRetry onRetry={() => void periods.refetch()} />
      </Screen>
    );
  }
  if (!current) {
    return (
      <Screen>
        <EmptyState
          icon="receipt-long"
          title="No periods yet"
          subtitle="Add your first Google Pay statement to see your overview."
          cta={<PrimaryPillButton label="Add a statement" expand={false} onPress={() => useSheets.getState().openPeriodSwitcher()} />}
        />
      </Screen>
    );
  }
  if (current.processingStatus !== 'COMPLETED') {
    return (
      <Screen>
        <ProcessingPlaceholder period={current} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} />} showsVerticalScrollIndicator={false}>
        <Header period={current} />
        <View style={{ paddingHorizontal: spacing.gutter, paddingTop: 24, paddingBottom: spacing.navClearance + insets.bottom }}>
          <SignalsPreview />
          <View style={{ height: 26 }} />
          <CategoryBreakdown expanded={expanded} onExpand={() => setExpanded(true)} />
        </View>
      </ScrollView>
    </View>
  );
}

function Header({ period }: { period: Statement }) {
  const insets = useSafeAreaInsets();
  const analytics = useCurrentPeriodAnalytics();
  const previous = usePreviousPeriodAnalytics();
  const user = useAuth((s) => s.user);
  const initials = user ? userInitials(user) : '?';

  return (
    <View style={{ backgroundColor: colors.ink900, paddingHorizontal: spacing.gutter, paddingTop: insets.top + 6, paddingBottom: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <PeriodPill label={formatPeriodRange(period.periodStart, period.periodEnd)} onPress={() => useSheets.getState().openPeriodSwitcher()} />
        <View style={{ flex: 1 }} />
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 34, height: 34, marginRight: 10, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink800, borderWidth: 1, borderColor: colors.hairlineDark }}
        >
          <MaterialIcons name="notifications-none" size={17} color={colors.onDarkMuted} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/profile')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <UserAvatar seed={user?.id} initials={initials} size={34} gradient={[colors.accent, colors.accentDim]} foregroundColor={colors.accentInk} />
        </Pressable>
      </View>
      <Text style={[typography.microLabel11, { color: colors.onDarkFaint, marginTop: 22 }]}>NET FLOW · {spanLabel(period)}</Text>
      <View style={{ height: 6 }} />
      {analytics.isPending ? (
        <View style={{ paddingVertical: 4 }}>
          <SkeletonBox width={180} height={40} dark />
          <View style={{ height: 16 }} />
          <SkeletonBox width="100%" height={8} radius={4} dark />
          <View style={{ height: 14 }} />
          <SkeletonBox width={120} height={30} dark />
        </View>
      ) : analytics.isError || !analytics.data ? (
        <Text style={[typography.footnote12, { color: colors.rose }]}>Could not load analytics.</Text>
      ) : (
        <NetFlow period={period} analytics={analytics.data} delta={netFlowDeltaPercent(analytics.data, previous.data)} />
      )}
    </View>
  );
}

function NetFlow({ period, analytics, delta }: { period: Statement; analytics: StatementAnalytics; delta: number | null }) {
  const net = analytics.totalIncome - analytics.totalSpend;
  const worse = delta != null && delta >= 0;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[typography.heroAmount44, { color: colors.onDark }]}>{formatCurrency(net)}</Text>
        {delta != null ? (
          <View style={{ marginLeft: 10 }}>
            <DeltaChip label={`${worse ? '▲' : '▼'} ${Math.abs(Math.round(delta))}%`} up={worse} tint={withAlpha(worse ? colors.rose : colors.accent, 0.16)} foreground={worse ? colors.rose : colors.accent} />
          </View>
        ) : null}
      </View>
      <View style={{ height: 16 }} />
      <View style={{ height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' }}>
        <LinearGradient colors={[colors.rose, colors.roseFlowGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: Math.max(1, Math.round(analytics.totalSpend)) }} />
        <View style={{ width: 3 }} />
        <View style={{ flex: Math.max(1, Math.round(analytics.totalIncome)), backgroundColor: colors.accent }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
        <View>
          <Text style={[typography.microLabel11, { color: colors.onDarkFaint }]}>SENT</Text>
          <Text style={[typography.amountMedium17, { color: colors.onDark }]}>{formatCurrency(analytics.totalSpend)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.microLabel11, { color: colors.onDarkFaint }]}>RECEIVED</Text>
          <Text style={[typography.amountMedium17, { color: colors.accentDim }]}>{formatCurrency(analytics.totalIncome)}</Text>
        </View>
      </View>
      {period.reconciliationOk != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 13, paddingVertical: 11, backgroundColor: colors.ink850, borderWidth: 1, borderColor: colors.hairlineDark, borderRadius: radius.field }}>
          <MaterialIcons name={period.reconciliationOk ? 'check' : 'info-outline'} size={15} color={period.reconciliationOk ? colors.accent : colors.amber} />
          <Text style={[typography.body14, { fontSize: 12, color: colors.onDarkMuted, flex: 1, marginLeft: 8 }]}>
            {period.reconciliationOk ? "Reconciled against the statement's own totals" : "Doesn't quite match the statement's declared totals"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function SignalsPreview() {
  const insights = useCurrentPeriodInsights();
  return (
    <View>
      <SectionHeader label="SIGNALS" labelColor={colors.onLightFaint} trailing={<TextActionLink label="All →" onPress={() => router.navigate('/signals')} />} />
      <View style={{ height: 12 }} />
      {insights.isPending ? (
        <View>
          <SkeletonBox width="100%" height={74} radius={16} />
          <View style={{ height: 12 }} />
          <SkeletonBox width="100%" height={74} radius={16} />
        </View>
      ) : insights.isError ? (
        <Text style={[typography.footnote12, { color: colors.onLightMuted }]}>Could not load signals.</Text>
      ) : !insights.data || insights.data.length === 0 ? (
        <Text style={[typography.footnote12, { color: colors.onLightMuted }]}>No signals yet for this period.</Text>
      ) : (
        insights.data.slice(0, 2).map((insight, i, preview) => (
          <View key={`${insight.type}-${i}`} style={{ marginBottom: i === preview.length - 1 ? 0 : 12 }}>
            <SignalCard kind={signalKindFromSeverity(insight.severity)} subtype={insight.type.toUpperCase()} body={insight.message} dark={false} entranceDelayMs={i * 60} />
          </View>
        ))
      )}
    </View>
  );
}

function CategoryBreakdown({ expanded, onExpand }: { expanded: boolean; onExpand: () => void }) {
  const analytics = useCurrentPeriodAnalytics();
  const previous = usePreviousPeriodAnalytics();

  if (analytics.isPending) {
    return (
      <View style={{ paddingVertical: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ marginBottom: i === 3 ? 0 : 12 }}>
            <SkeletonBox width="100%" height={34} />
          </View>
        ))}
      </View>
    );
  }
  const data = analytics.data;
  if (analytics.isError || !data) return null;
  const spending = spendingBreakdown(data);
  if (spending.length === 0) return null;

  const sorted = [...spending].sort((a, b) => b.totalAmount - a.totalAmount);
  const totalOfShown = data.totalSpend;
  const maxAmount = sorted[0].totalAmount === 0 ? 1 : sorted[0].totalAmount;
  const visible = expanded ? sorted : sorted.slice(0, 4);
  const previousCategories = previous.data?.categoryBreakdown;

  return (
    <View>
      <SectionHeader label="WHERE IT WENT" labelColor={colors.onLightFaint} trailing={<Text style={[typography.body14, { fontSize: 12, color: colors.onLightFaint }]}>of {formatCurrency(totalOfShown)}</Text>} />
      <View style={{ height: 4 }} />
      {visible.map((entry) => (
        <CategoryBarRow
          key={entry.category}
          name={entry.category}
          amountLabel={formatCurrency(entry.totalAmount)}
          percentOfTotal={totalOfShown === 0 ? 0 : Math.round((entry.totalAmount / totalOfShown) * 100)}
          relativeWidthFraction={entry.totalAmount / maxAmount}
          color={categoryColor(entry.category)}
          trendCaption={trendCaption(entry.category, entry.totalAmount, previousCategories) ?? undefined}
          onPress={() => router.push(`/category/${encodeURIComponent(entry.category)}`)}
        />
      ))}
      {!expanded && sorted.length > 4 ? (
        <View style={{ marginTop: 8 }}>
          <TextActionLink label={`Show ${sorted.length - 4} more categories`} onPress={onExpand} />
        </View>
      ) : null}
    </View>
  );
}

function ProcessingPlaceholder({ period }: { period: Statement }) {
  // Follow the job while this is on screen: the periods query is a one-shot
  // fetch, so without this the placeholder outlives the analysis itself.
  useJobPoll(period.currentJobId, (job, previous) => {
    if (job.status === 'COMPLETED' && previous?.status !== 'COMPLETED') void alertUnusualSpendIfEnabled(period.id);
    if (job.status === 'COMPLETED' || job.status === 'FAILED') void invalidatePeriods();
  });
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.gutter }}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[typography.bigHeadline22, { color: colors.onLight, textAlign: 'center', marginTop: 20 }]}>We're still analysing your statement</Text>
      <Text style={[typography.footnote12, { color: colors.onLightMuted, textAlign: 'center', marginTop: 8 }]}>{period.originalFilename}</Text>
      {period.currentJobId ? (
        <View style={{ marginTop: 20 }}>
          <PrimaryPillButton label="View progress" expand={false} onPress={() => router.push(`/upload/analysing/${period.currentJobId}`)} />
        </View>
      ) : null}
    </View>
  );
}

/** Full-page skeleton matching Overview's header/signals/category layout, shown while the initial periods load is in flight. */
function OverviewSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ backgroundColor: colors.ink900, paddingHorizontal: spacing.gutter, paddingTop: insets.top + 6, paddingBottom: 26 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SkeletonBox width={96} height={30} radius={100} dark />
          <View style={{ flex: 1 }} />
          <SkeletonBox width={34} height={34} radius={17} dark />
          <View style={{ width: 10 }} />
          <SkeletonBox width={34} height={34} radius={17} dark />
        </View>
        <View style={{ height: 26 }} />
        <SkeletonBox width={140} height={12} dark />
        <View style={{ height: 10 }} />
        <SkeletonBox width={180} height={40} dark />
        <View style={{ height: 16 }} />
        <SkeletonBox width="100%" height={8} radius={4} dark />
      </View>
      <View style={{ paddingHorizontal: spacing.gutter, paddingTop: 24 }}>
        <SkeletonBox width={90} height={12} />
        <View style={{ height: 12 }} />
        <SkeletonBox width="100%" height={74} radius={16} />
        <View style={{ height: 12 }} />
        <SkeletonBox width="100%" height={74} radius={16} />
        <View style={{ height: 26 }} />
        <SkeletonBox width={120} height={12} />
        <View style={{ height: 16 }} />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <SkeletonBox width="100%" height={34} />
          </View>
        ))}
      </View>
    </View>
  );
}
