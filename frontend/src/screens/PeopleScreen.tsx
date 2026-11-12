import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { timelineRepository } from '../api/instance';
import { AvatarChip } from '../components/Avatars';
import { ScreenBackHeader } from '../components/Controls';
import { EmptyState, ErrorRetry, withAlpha } from '../components/Display';
import { Screen } from '../components/Screen';
import type { PersonLedgerRow, Transaction } from '../domain/types';
import { invalidatePeriodData } from '../hooks/periods';
import { formatCurrency, formatDayMonth, formatPeriodRange } from '../lib/format';
import { errorMessage, useAuth } from '../state/auth';
import { showToast } from '../state/toast';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

/** "You are ₹2,300 up with Ravi", "You are ₹500 down with Priya", "You are even with Anjali". */
export function netSentence(row: Pick<PersonLedgerRow, 'name' | 'net'>): string {
  const first = titleCase(row.name).split(' ')[0];
  if (Math.abs(row.net) < 0.005) return `You are even with ${first}`;
  return row.net > 0 ? `You are ${formatCurrency(row.net)} up with ${first}` : `You are ${formatCurrency(-row.net)} down with ${first}`;
}

/** Statements print names in capitals; "RAVI KUMAR" reads better as "Ravi Kumar". */
export function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export function ledgerTotals(rows: readonly PersonLedgerRow[]): { sent: number; received: number; net: number } {
  const sent = rows.reduce((s, r) => s + r.sent, 0);
  const received = rows.reduce((s, r) => s + r.received, 0);
  return { sent, received, net: received - sent };
}

/**
 * People are not merchants (PROJECT_AUDIT.md B3): a ledger per person with
 * what you sent, what they sent, and the difference - across every period.
 */
export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuth((s) => s.user?.id ?? null);
  const people = useQuery({ queryKey: ['people', userId], queryFn: () => timelineRepository.people() });
  const [open, setOpen] = useState<string | null>(null);

  if (people.isPending) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.signal} />
        </View>
      </Screen>
    );
  }
  if (people.isError && !people.data) {
    return (
      <Screen>
        <ErrorRetry message="Could not load your people." onRetry={() => void people.refetch()} />
      </Screen>
    );
  }

  const rows = people.data ?? [];
  const totals = ledgerTotals(rows);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: 6, paddingBottom: 28 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <ScreenBackHeader title="People" />
        {rows.length === 0 ? (
          <View style={{ marginTop: 60 }}>
            <EmptyState icon="user" title="No people yet" subtitle="When a statement has payments to or from a person, they appear here with what you sent, what they sent, and the difference." />
          </View>
        ) : (
          <>
            <Text style={[typography.microLabel11, { color: colors.faint, marginTop: 18 }]}>ACROSS ALL YOUR PERIODS</Text>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <Total label="YOU SENT" value={formatCurrency(totals.sent)} />
              <Total label="YOU RECEIVED" value={formatCurrency(totals.received)} />
              <Total label="NET" value={formatCurrency(totals.net, true)} color={totals.net >= 0 ? colors.signalText : colors.warn} />
            </View>
            <View style={{ height: 18 }} />
            {rows.map((row) => (
              <PersonRow key={row.payeeKey} row={row} expanded={open === row.payeeKey} onToggle={() => setOpen(open === row.payeeKey ? null : row.payeeKey)} />
            ))}
            <Text style={[typography.footnote12, { color: colors.faint, textAlign: 'center', marginTop: 10 }]}>
              People stay private: a person's name is never used to label anyone else's payments.
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Total({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typography.microLabel11, { color: colors.faint }]}>{label}</Text>
      <Text style={[typography.amountMedium15, { color: color ?? colors.text, marginTop: 4 }]}>{value}</Text>
    </View>
  );
}

function PersonRow({ row, expanded, onToggle }: { row: PersonLedgerRow; expanded: boolean; onToggle: () => void }) {
  const name = titleCase(row.name);
  const up = row.net >= 0;
  return (
    <View style={{ marginBottom: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${name}. ${netSentence(row)}.`} onPress={onToggle} style={({ pressed }) => [{ padding: 16 }, pressed && { opacity: 0.6 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AvatarChip initials={name[0] ?? '?'} size={40} radius={20} backgroundColor={withAlpha(colors.signal, 0.14)} foregroundColor={colors.signalText} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[typography.rowLabel145, { color: colors.text }]}>{name}</Text>
            <Text style={[typography.meta115, { color: colors.faint, marginTop: 2 }]}>
              {row.count === 1 ? '1 payment' : `${row.count} payments`} · {formatPeriodRange(row.firstAt, row.lastAt)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[typography.amountMedium16, { color: up ? colors.signalText : colors.warn }]}>{formatCurrency(row.net, true)}</Text>
            <Text style={[typography.microLabel11, { color: colors.faint }]}>NET</Text>
          </View>
        </View>
        <Text style={[typography.footnote12, { color: colors.muted, marginTop: 12 }]}>
          {netSentence(row)}. Sent {formatCurrency(row.sent)}, received {formatCurrency(row.received)}.
        </Text>
      </Pressable>
      {expanded ? <PersonHistory row={row} /> : null}
    </View>
  );
}

function PersonHistory({ row }: { row: PersonLedgerRow }) {
  const history = useQuery({ queryKey: ['people', 'history', row.payeeKey], queryFn: () => timelineRepository.personTransactions(row.payeeKey), staleTime: 0 });
  const [busy, setBusy] = useState(false);

  const markAsBusiness = async () => {
    setBusy(true);
    try {
      await timelineRepository.setPayeeKind(row.name, 'business');
      await invalidatePeriodData();
      showToast(`${titleCase(row.name)} is now treated as a business.`, 'success');
    } catch (e) {
      showToast(errorMessage(e), 'error');
      setBusy(false);
    }
  };

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingVertical: 10 }}>
      {history.isPending ? (
        <ActivityIndicator size="small" color={colors.signal} style={{ marginVertical: 10 }} />
      ) : history.isError ? (
        <Text style={[typography.footnote12, { color: colors.muted, paddingVertical: 8 }]}>Could not load the payments.</Text>
      ) : (
        history.data.map((t: Transaction) => (
          <View key={t.id} style={{ flexDirection: 'row', paddingVertical: 7 }}>
            <Text style={[typography.body13, { color: colors.muted, flex: 1 }]}>
              {formatDayMonth(t.timestamp)} · {t.transactionType === 'DEBIT' ? 'you sent' : 'you received'}
            </Text>
            <Text style={[typography.amountMedium15, { color: t.transactionType === 'DEBIT' ? colors.text : colors.signalText }]}>
              {t.transactionType === 'DEBIT' ? '−' : '+'}
              {formatCurrency(t.amount)}
            </Text>
          </View>
        ))
      )}
      <Pressable accessibilityRole="button" disabled={busy} hitSlop={8} onPress={() => void markAsBusiness()} style={{ alignSelf: 'flex-start', paddingVertical: 8, opacity: busy ? 0.4 : 1 }}>
        <Text style={[typography.buttonLabel12, { color: colors.signalText }]}>This is a business, not a person</Text>
      </Pressable>
    </View>
  );
}
