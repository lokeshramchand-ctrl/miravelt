import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Icon } from '../components/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { statementsRepository } from '../api/instance';
import { EmptyState, ErrorRetry, FadeInUpCard, MiraveltListRow, withAlpha } from '../components/Display';
import { Screen } from '../components/Screen';
import { MiraveltSheet } from '../components/Sheet';
import { SegmentedControl } from '../components/Controls';
import { SkeletonListRow } from '../components/Skeleton';
import { TransactionSheet } from '../components/TransactionSheet';
import type { Statement, Transaction, TransactionType } from '../domain/types';
import { useCurrentPeriod, useCurrentPeriodAnalytics } from '../hooks/periods';
import { formatCurrency, formatDayHeader, formatTime12h } from '../lib/format';
import { categoryColor, categoryIcon, colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

export interface DayGroup {
  day: Date;
  transactions: Transaction[];
}

/** Consecutive transactions on the same calendar day (the list arrives sorted, so same-day rows are adjacent). */
export function groupByDay(transactions: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const txn of transactions) {
    const day = new Date(txn.timestamp.getFullYear(), txn.timestamp.getMonth(), txn.timestamp.getDate());
    const last = groups[groups.length - 1];
    if (last && last.day.getTime() === day.getTime()) last.transactions.push(txn);
    else groups.push({ day, transactions: [txn] });
  }
  return groups;
}

/** Net movement of a day: credits in, debits out. */
export function dayTotal(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + (t.transactionType === 'DEBIT' ? -t.amount : t.amount), 0);
}

interface Filters {
  typeFilter: TransactionType | null;
  category: string | null;
  sortByAmount: boolean;
  merchantQuery: string;
}

const NO_FILTERS: Filters = { typeFilter: null, category: null, sortByAmount: false, merchantQuery: '' };
const PAGE_SIZE = 30;

function useActivity(period: Statement | null, filters: Filters) {
  return useInfiniteQuery({
    queryKey: ['activity', period?.id ?? null, filters],
    enabled: period != null,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      statementsRepository.transactions(period!.id, {
        page: pageParam,
        pageSize: PAGE_SIZE,
        category: filters.category ?? undefined,
        transactionType: filters.typeFilter ?? undefined,
        merchant: filters.merchantQuery || undefined,
        sortBy: filters.sortByAmount ? 'amount' : 'timestamp',
        sortOrder: 'desc',
      }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const period = useCurrentPeriod();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const activity = useActivity(period, filters);
  const [refreshing, setRefreshing] = useState(false);

  const transactions = useMemo(() => activity.data?.pages.flatMap((p) => p.items) ?? [], [activity.data]);
  const groups = useMemo(() => groupByDay(transactions), [transactions]);
  const total = activity.data?.pages[0]?.total;

  const patch = (change: Partial<Filters>) => setFilters((f) => ({ ...f, ...change }));
  const bottomPad = spacing.navClearance + insets.bottom;

  return (
    <Screen>
      <Header total={total} period={period} filters={filters} onChange={patch} />
      <View style={{ flex: 1 }}>
        {activity.isPending && period ? (
          <View style={{ paddingHorizontal: spacing.gutter, paddingTop: 8 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <SkeletonListRow key={i} />
            ))}
          </View>
        ) : activity.isError ? (
          <ErrorRetry onRetry={() => void activity.refetch()} />
        ) : !period ? null : transactions.length === 0 ? (
          <EmptyState icon="search-off" title="No transactions match these filters" subtitle="Try clearing the search or filter chips above." />
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(g) => g.day.toISOString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: 8, paddingBottom: bottomPad }}
            onEndReachedThreshold={0.6}
            onEndReached={() => {
              if (activity.hasNextPage && !activity.isFetchingNextPage) void activity.fetchNextPage();
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={colors.signal}
                colors={[colors.signal]}
                onRefresh={async () => {
                  setRefreshing(true);
                  await activity.refetch();
                  setRefreshing(false);
                }}
              />
            }
            ListFooterComponent={activity.isFetchingNextPage ? <SkeletonListRow /> : null}
            renderItem={({ item: group, index }) => <DaySection group={group} index={index} onSelect={setSelected} />}
          />
        )}
      </View>
      <TransactionSheet transaction={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

function DaySection({ group, index, onSelect }: { group: DayGroup; index: number; onSelect: (t: Transaction) => void }) {
  const net = dayTotal(group.transactions);
  return (
    <FadeInUpCard delay={Math.min(6, index) * 40}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
        <Text style={[typography.microLabelTracked11, { color: colors.faint }]}>{formatDayHeader(group.day)}</Text>
        <Text style={[typography.microLabelTracked11, { color: net > 0 ? colors.signalText : colors.faint }]}>{formatCurrency(net, net > 0)}</Text>
      </View>
      {group.transactions.map((txn) => {
        const color = categoryColor(txn.category ?? '');
        return (
          <MiraveltListRow
            key={txn.id}
            avatarInitials={txn.merchant ? txn.merchant[0].toUpperCase() : '?'}
            avatarTint={withAlpha(color, 0.16)}
            avatarInk={color}
            icon={categoryIcon(txn.category ?? '')}
            title={txn.merchant ?? 'Unknown merchant'}
            subtitle={`${formatTime12h(txn.timestamp)} · ${txn.category ?? 'Uncategorized'}`}
            trailingAmount={`${txn.transactionType === 'DEBIT' ? '−' : '+'}${formatCurrency(Math.abs(txn.amount))}`}
            trailingAmountColor={txn.transactionType === 'CREDIT' ? colors.signalText : undefined}
            badgeLabel={txn.status !== 'SUCCESS' ? txn.status : undefined}
            onPress={() => onSelect(txn)}
          />
        );
      })}
    </FadeInUpCard>
  );
}

function Header({ total, period, filters, onChange }: { total: number | undefined; period: Statement | null; filters: Filters; onChange: (change: Partial<Filters>) => void }) {
  const analytics = useCurrentPeriodAnalytics();
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState(false);
  const categories = analytics.data?.categoryBreakdown.map((e) => e.category) ?? [];

  return (
    <View style={{ paddingHorizontal: spacing.gutter, paddingTop: 14, paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text style={[typography.footnote12, { color: colors.muted }]}>{total ?? period?.transactionCount ?? 0} transactions</Text>
          <Text style={[typography.pageTitle, { color: colors.text, marginTop: 4 }]}>Activity</Text>
        </View>
      </View>
      <View style={{ height: 12 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill }}>
        <Icon name="search" size={16} color={colors.faint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => onChange({ merchantQuery: query.trim() })}
          returnKeyType="search"
          placeholder="Search merchant, amount, UPI ID"
          placeholderTextColor={colors.faint}
          selectionColor={colors.signalText}
          autoCorrect={false}
          style={[typography.body14, { flex: 1, fontSize: 13, color: colors.text, paddingVertical: 11, marginLeft: 8 }]}
        />
      </View>
      <View style={{ height: 10 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ alignItems: 'center' }}>
        <View style={{ marginRight: 7 }}>
          <SegmentedControl<'all' | 'DEBIT' | 'CREDIT'>
            options={[['all', 'All'], ['DEBIT', 'Out'], ['CREDIT', 'In']]}
            value={filters.typeFilter ?? 'all'}
            onChange={(v) => onChange({ typeFilter: v === 'all' ? null : v })}
          />
        </View>
        <FilterChip label={filters.category ?? 'Category ▾'} selected={filters.category != null} onPress={() => setPicking(true)} />
        <FilterChip label="₹ ▾" selected={filters.sortByAmount} onPress={() => onChange({ sortByAmount: !filters.sortByAmount })} last />
      </ScrollView>
      <MiraveltSheet visible={picking} onClose={() => setPicking(false)} eyebrow="Filter" title="Category" sub="Show only one kind of spend.">
        <CategoryChoice
          categories={categories}
          onPick={(category) => {
            setPicking(false);
            onChange({ category });
          }}
        />
      </MiraveltSheet>
    </View>
  );
}

function CategoryChoice({ categories, onPick }: { categories: string[]; onPick: (category: string | null) => void }) {
  return (
    <View>
      {[null, ...categories].map((category) => (
        <Pressable key={category ?? '__all'} accessibilityRole="button" onPress={() => onPick(category)} style={({ pressed }) => [{ paddingVertical: 14 }, pressed && { opacity: 0.5 }]}>
          <Text style={[typography.rowLabel14, { color: colors.text }]}>{category ?? 'All categories'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function FilterChip({ label, selected, onPress, last = false }: { label: string; selected: boolean; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        height: 38,
        paddingHorizontal: 14,
        marginRight: last ? 0 : 7,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? colors.ink : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.ink : colors.border,
        borderRadius: 100,
      }}
    >
      <Text style={[typography.buttonLabel13, { color: selected ? colors.onInk : colors.text }]}>{label}</Text>
    </Pressable>
  );
}
