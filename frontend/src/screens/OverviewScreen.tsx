import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { IconButton, PrimaryPillButton, TextActionLink } from '../components/Buttons';
import { Backdrop } from '../components/Backdrop';
import { CategoryArc } from '../components/CategoryArc';
import { UserAvatar } from '../components/Avatars';
import { ContextMeter } from '../components/Charts';
import { PeriodPill } from '../components/Controls';
import { Card, CategoryBarRow, DeltaChip, Divider, EmptyState, ErrorRetry, SectionHeader, SignalCard, signalKindFromSeverity, Stat } from '../components/Display';
import { Icon, IconChip } from '../components/Icon';
import { FadeInUp, PressableScale } from '../components/motion';
import { AnimatedNumber } from '../components/Delight';
import { haptics } from '../lib/haptics';
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
import { formatCompactCurrency, formatCurrency, formatPeriodRange, monthsSpanned } from '../lib/format';
import { startUploadFlow } from '../state/upload';
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
/** How much of the period's spending has no category, as an amount and a share of total spend. */
export function unlabelledSpend(analytics: Pick<StatementAnalytics, 'categoryBreakdown' | 'totalSpend'>): { amount: number; share: number } {
  const amount = analytics.categoryBreakdown.filter((e) => e.category === 'Uncategorized' || e.category === 'Unknown').reduce((sum, e) => sum + e.totalAmount, 0);
  return { amount, share: analytics.totalSpend > 0 ? amount / analytics.totalSpend : 0 };
}

/** The line under "Reconciled" / "Totals differ" - says how many records could not be read when that is the reason (A6). */
export function reconciliationCaption(period: Pick<Statement, 'reconciliationOk' | 'unparsedCount'>): string {
  if (period.reconciliationOk) return "Matches the statement's own totals";
  const unread = period.unparsedCount ?? 0;
  if (unread > 0) return unread === 1 ? '1 payment in the PDF could not be read, so the totals are short' : `${unread} payments in the PDF could not be read, so the totals are short`;
  return "Doesn't quite match the statement's declared totals";
}

export function netFlowDeltaPercent(current: StatementAnalytics, previous: StatementAnalytics | undefined): number | null {
  if (!previous) return null;
  const net = current.totalIncome - current.totalSpend;
  const prevNet = previous.totalIncome - previous.totalSpend;
  return prevNet === 0 ? null : ((prevNet - net) / Math.abs(prevNet)) * 100;
}

function spanLabel(period: Statement): string {
  const months = monthsSpanned(period.periodStart, period.periodEnd);
  return months <= 1 ? '1 MONTH' : `${months} MONTHS`;
}

/** A time-of-day greeting over the page title. */
function greeting(): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const name = useAuth.getState().user?.fullName?.trim().split(/\s+/)[0];
  return `${part}${name ? `, ${name}` : ''} · here's how you've been spending`;
}

/** Debit totals per week across the period (from the backend's daily trend), oldest first - the hero's spark. */
export function weeklySpend(analytics: StatementAnalytics, period: Pick<Statement, 'periodStart' | 'periodEnd'>): number[] {
  const start = period.periodStart.getTime();
  const weeks = Math.max(1, Math.ceil((period.periodEnd.getTime() - start + 1) / (7 * 86400000)));
  const out = new Array<number>(weeks).fill(0);
  for (const d of analytics.dailyTrend) {
    const w = Math.floor((d.date.getTime() - start) / (7 * 86400000));
    if (w >= 0 && w < weeks) out[w] += d.totalAmount;
  }
  return out;
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

  const scrollY = useRef(new Animated.Value(0)).current;
  const refresh = async () => {
    haptics.tap();
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
          cta={<PrimaryPillButton label="Add a statement" icon="plus" expand={false} onPress={() => useSheets.getState().openPeriodSwitcher()} />}
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Backdrop />
      <Animated.ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.signal} colors={[colors.signal]} progressViewOffset={insets.top + 56} />}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => scrollY.setValue(e.nativeEvent.contentOffset.y)}
      >
        <View style={{ paddingHorizontal: spacing.gutter, paddingTop: insets.top + 56, paddingBottom: spacing.navClearance + insets.bottom }}>
          <Hero period={current} scrollY={scrollY} />
          <QuickStats period={current} />
          <View style={{ height: 28 }} />
          <SignalsPreview />
          <View style={{ height: 28 }} />
          <TeachBanner period={current} />
          <CategoryBreakdown expanded={expanded} onExpand={() => setExpanded(true)} />
        </View>
      </Animated.ScrollView>
      <StickyTopBar period={current} scrollY={scrollY} />
    </View>
  );
}

/** The top bar stays put; once content slides under it, it frosts over and gains a hairline. */
function StickyTopBar({ period, scrollY }: { period: Statement; scrollY: Animated.Value }) {
  const insets = useSafeAreaInsets();
  const shown = scrollY.interpolate({ inputRange: [0, 40], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, paddingTop: insets.top + 6, paddingBottom: 6, paddingHorizontal: spacing.gutter }}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { opacity: shown, backgroundColor: colors.scheme === 'dark' ? '#13161a' : '#eef0f1', borderBottomWidth: 1, borderBottomColor: colors.border },
          Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px) saturate(1.3)' } as object) : null,
        ]}
      />
      <TopBar period={period} />
    </View>
  );
}

function TopBar({ period }: { period: Statement }) {
  const user = useAuth((s) => s.user);
  const initials = user ? userInitials(user) : '?';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <PeriodPill label={formatPeriodRange(period.periodStart, period.periodEnd)} onPress={() => useSheets.getState().openPeriodSwitcher()} />
      <View style={{ flex: 1 }} />
      <IconButton icon="plus" label="Add a statement" onPress={() => startUploadFlow()} />
      <View style={{ width: 8 }} />
      <IconButton icon="gear" label="Settings" onPress={() => router.push('/profile')} />
      <View style={{ width: 8 }} />
      <PressableScale accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/profile')} scaleTo={0.9}>
        <UserAvatar seed={user?.id} initials={initials} size={42} />
      </PressableScale>
    </View>
  );
}

/** "Your latest insights": the category arc wrapped around the period's total spend. */
function Hero({ period, scrollY }: { period: Statement; scrollY: Animated.Value }) {
  const analytics = useCurrentPeriodAnalytics();
  const previous = usePreviousPeriodAnalytics();
  const data = analytics.data;
  return (
    <FadeInUp distance={10}>
      {/* The title drifts up a little slower than the page and fades as it nears the top bar. */}
      <Animated.View
        style={{
          opacity: scrollY.interpolate({ inputRange: [0, 90], outputRange: [1, 0], extrapolate: 'clamp' }),
          transform: [{ translateY: scrollY.interpolate({ inputRange: [-100, 0, 100], outputRange: [-30, 0, 34], extrapolate: 'clamp' }) }],
        }}
      >
        <Text style={[typography.footnote12, { color: colors.muted, marginTop: 14 }]}>{greeting()}</Text>
        <Text style={[typography.pageTitle, { color: colors.text, marginTop: 4 }]}>Your latest insights</Text>
      </Animated.View>
      {analytics.isPending ? (
        <View style={{ height: 360, justifyContent: 'center' }}>
          <SkeletonBox width={200} height={44} />
        </View>
      ) : analytics.isError || !data ? (
        <Text style={[typography.footnote12, { color: colors.down, marginTop: 20 }]}>Could not load analytics.</Text>
      ) : (
        <CategoryArc
          categories={[...spendingBreakdown(data)].sort((x, y) => y.totalAmount - x.totalAmount).map((e) => ({ category: e.category, amount: e.totalAmount }))}
          total={data.totalSpend}
          onOpen={(c) => router.push(`/category/${encodeURIComponent(c)}`)}
          onAdd={() => startUploadFlow()}
        >
          <TotalSpent period={period} analytics={data} previous={previous.data} />
        </CategoryArc>
      )}
    </FadeInUp>
  );
}

function TotalSpent({ period, analytics, previous }: { period: Statement; analytics: StatementAnalytics; previous: StatementAnalytics | undefined }) {
  const change = previous ? analytics.totalSpend - previous.totalSpend : null;
  return (
    <View>
      <Text style={[typography.footnote1155, { color: colors.muted }]}>Total spent · {spanLabel(period).toLowerCase()}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <AnimatedNumber value={analytics.totalSpend} format={formatCurrency} numberOfLines={1} duration={1200} style={[typography.heroAmount40, { color: colors.text, flexShrink: 1 }]} />
        <Icon name="arrow-up-right" size={18} color={colors.text} style={{ marginLeft: 6 }} />
      </View>
      {change != null ? (
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.border2 }}>
            <Text style={[typography.meta12, { color: colors.text }]}>
              {change >= 0 ? '+ ' : '− '}
              {formatCurrency(Math.abs(change))}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Net flow, received and payments as glass cards, plus the reconciliation line. Every figure is a backend field. */
function QuickStats({ period }: { period: Statement }) {
  const analytics = useCurrentPeriodAnalytics();
  const previous = usePreviousPeriodAnalytics();
  const data = analytics.data;
  if (!data) return null;
  const net = data.totalIncome - data.totalSpend;
  const delta = netFlowDeltaPercent(data, previous.data);
  const incomeChange = previous.data && previous.data.totalIncome > 0 ? ((data.totalIncome - previous.data.totalIncome) / previous.data.totalIncome) * 100 : null;
  const weeks = weeklySpend(data, period);
  return (
    <View>
      <FadeInUp delay={80}>
        <Stat
          label="Net flow"
          value={formatCurrency(net)}
          amount={net}
          format={formatCurrency}
          sub={`${net >= 0 ? '↗ kept' : '↘ overspent'} · ${Math.round((Math.abs(net) / Math.max(1, data.totalIncome)) * 100)}% of income`}
          spark={weeks}
          badge={delta != null ? <DeltaChip label={`${delta >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(delta))}%`} up={delta >= 0} tone={delta >= 0 ? 'down' : 'up'} /> : undefined}
        />
      </FadeInUp>
      <FadeInUp delay={140} style={{ flexDirection: 'row', marginTop: 10 }}>
        <Stat
          style={{ flex: 1 }}
          label="Received"
          value={formatCompactCurrency(data.totalIncome)}
          sub="came in"
          badge={incomeChange != null ? <DeltaChip label={`${incomeChange >= 0 ? '+' : '−'}${Math.abs(incomeChange).toFixed(1)}%`} up={incomeChange >= 0} tone={incomeChange >= 0 ? 'up' : 'down'} /> : undefined}
        />
        <View style={{ width: 10 }} />
        <Stat
          style={{ flex: 1 }}
          label="Payments"
          value={`${data.transactionCount}`}
          amount={data.transactionCount}
          format={String}
          sub={`avg ${formatCurrency(data.averageTransactionValue)}`}
          badge={<DeltaChip label={data.failedTransactionCount > 0 ? `${data.failedTransactionCount} failed` : 'All good'} up={false} tone={data.failedTransactionCount > 0 ? 'down' : 'up'} />}
        />
      </FadeInUp>
      {period.reconciliationOk != null ? (
        <FadeInUp delay={200} style={{ marginTop: 10 }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 }}>
            <IconChip name={period.reconciliationOk ? 'shield-check' : 'info-outline'} tone={period.reconciliationOk ? 'up' : 'warn'} size={34} iconSize={17} style={{ borderRadius: 17 }} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.rowLabel14, { color: colors.text }]}>{period.reconciliationOk ? 'Reconciled' : 'Totals differ'}</Text>
              <Text style={[typography.footnote1155, { color: colors.muted, marginTop: 1 }]}>{reconciliationCaption(period)}</Text>
            </View>
          </Card>
        </FadeInUp>
      ) : null}
      {period.isSample ? (
        <FadeInUp delay={240} style={{ marginTop: 10 }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 }}>
            <IconChip name="auto-awesome" size={34} iconSize={17} style={{ borderRadius: 17 }} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.rowLabel14, { color: colors.text }]}>Sample data</Text>
              <Text style={[typography.footnote1155, { color: colors.muted, marginTop: 1 }]}>A generated statement, not your money. Remove it in Profile, Manage periods.</Text>
            </View>
          </Card>
        </FadeInUp>
      ) : null}
    </View>
  );
}

/**
 * "Teach Miravelt in 30 seconds" - shown only when there is uncategorised
 * spend worth a minute of the user's time (PROJECT_AUDIT.md B2).
 */
function TeachBanner({ period }: { period: Statement }) {
  const analytics = useCurrentPeriodAnalytics();
  const unknown = analytics.data ? unlabelledSpend(analytics.data) : null;
  if (!unknown || unknown.share < 0.05) return null;
  return (
    <FadeInUp delay={120} style={{ marginBottom: 28 }}>
      <PressableScale accessibilityRole="button" onPress={() => router.push('/teach')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 }}>
          <IconChip name="auto-awesome" tone="up" size={38} iconSize={18} style={{ borderRadius: 19 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[typography.rowLabel14, { color: colors.text }]}>Teach Miravelt in 30 seconds</Text>
            <Text style={[typography.footnote1155, { color: colors.muted, marginTop: 2 }]}>
              {formatCurrency(unknown.amount)} ({Math.round(unknown.share * 100)}% of {period.isSample ? 'the sample' : 'your'} spending) has no category yet. A few taps fixes most of it.
            </Text>
          </View>
          <Icon name="chevron-right" size={14} color={colors.faint} />
        </Card>
      </PressableScale>
    </FadeInUp>
  );
}

function SignalsPreview() {
  const insights = useCurrentPeriodInsights();
  return (
    <View>
      <SectionHeader label="Signals" sub="What stood out this period" trailing={<TextActionLink label="See all" icon="arrow-right" onPress={() => router.navigate('/signals')} />} />
      <View style={{ height: 12 }} />
      {insights.isPending ? (
        <View>
          <SkeletonBox width="100%" height={96} radius={16} />
          <View style={{ height: 10 }} />
          <SkeletonBox width="100%" height={96} radius={16} delay={120} />
        </View>
      ) : insights.isError ? (
        <Text style={[typography.footnote12, { color: colors.muted }]}>Could not load signals.</Text>
      ) : !insights.data || insights.data.length === 0 ? (
        <Text style={[typography.footnote12, { color: colors.muted }]}>No signals yet for this period.</Text>
      ) : (
        insights.data.slice(0, 2).map((insight, i, preview) => (
          <View key={`${insight.type}-${i}`} style={{ marginBottom: i === preview.length - 1 ? 0 : 10 }}>
            <SignalCard kind={signalKindFromSeverity(insight.severity)} subtype={insight.type.toUpperCase()} body={insight.message} entranceDelayMs={i * 70} />
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
            <SkeletonBox width="100%" height={34} delay={i * 90} />
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
      <SectionHeader label="Where it went" sub="Tap the bar to isolate a category" />
      <View style={{ height: 12 }} />
      <Card style={{ paddingBottom: 6 }}>
        <ContextMeter
          parts={sorted.map((e) => ({ label: e.category, value: e.totalAmount, color: categoryColor(e.category) }))}
          total={totalOfShown}
          fmt={formatCurrency}
          legend={false}
        />
        <View style={{ height: 14 }} />
        <Divider />
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
          <View style={{ paddingVertical: 12 }}>
            <TextActionLink label={`Show ${sorted.length - 4} more categories`} icon="keyboard-arrow-down" onPress={onExpand} />
          </View>
        ) : null}
      </Card>
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
      <IconChip name="autorenew" size={52} iconSize={24} tone="signal" />
      <ActivityIndicator size="small" color={colors.signal} style={{ marginTop: 18 }} />
      <Text style={[typography.bigHeadline22, { color: colors.text, textAlign: 'center', marginTop: 14 }]}>We're still analysing your statement</Text>
      <Text style={[typography.footnote12, { color: colors.muted, textAlign: 'center', marginTop: 8 }]}>{period.originalFilename}</Text>
      {period.currentJobId ? (
        <View style={{ marginTop: 20 }}>
          <PrimaryPillButton label="View progress" icon="arrow-right" expand={false} onPress={() => router.push(`/upload/analysing/${period.currentJobId}`)} />
        </View>
      ) : null}
    </View>
  );
}

/** Full-page skeleton matching Overview's top bar / hero / signals / category layout, shown while the initial periods load is in flight. */
function OverviewSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.gutter, paddingTop: insets.top + 6 }}>
      <Backdrop />
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
        <SkeletonBox width={150} height={38} radius={100} />
        <View style={{ flex: 1 }} />
        <SkeletonBox width={38} height={38} radius={19} />
      </View>
      <View style={{ height: 14 }} />
      <SkeletonBox width="100%" height={300} radius={22} />
      <View style={{ height: 12 }} />
      <SkeletonBox width="100%" height={58} radius={16} delay={90} />
      <View style={{ height: 12 }} />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          <SkeletonBox width="100%" height={118} radius={16} delay={180} />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <SkeletonBox width="100%" height={118} radius={16} delay={180} />
        </View>
      </View>
    </View>
  );
}
