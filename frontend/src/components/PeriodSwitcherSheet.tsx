import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { Statement } from '../domain/types';
import { useCurrentPeriod, useJobSnapshot, usePeriods } from '../hooks/periods';
import { formatCurrency, formatPeriodRange } from '../lib/format';
import { useSession } from '../state/session';
import { useSheets } from '../state/sheets';
import { startUploadFlow } from '../state/upload';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { PulsingDot } from './Charts';
import { MiraveltSheet } from './Sheet';

export function PeriodSwitcherHost() {
  const open = useSheets((s) => s.periodSwitcherOpen);
  const close = useSheets((s) => s.closePeriodSwitcher);
  return (
    <MiraveltSheet visible={open} onClose={close} dark>
      {open ? <PeriodSwitcherBody onClose={close} /> : null}
    </MiraveltSheet>
  );
}

const isLive = (p: Statement) => p.processingStatus === 'PENDING' || p.processingStatus === 'PROCESSING';

function PeriodSwitcherBody({ onClose }: { onClose: () => void }) {
  const periods = usePeriods();
  const current = useCurrentPeriod();

  return (
    <View>
      <Text style={[typography.bigHeadline26, { fontSize: 20, color: colors.onDark }]}>Choose a period</Text>
      <Text style={[typography.body13, { color: colors.onDarkMuted, marginTop: 6, lineHeight: 18 }]}>Each period is one Google Pay statement you've added.</Text>
      <View style={{ height: 18 }} />
      {periods.isPending ? (
        <View style={{ paddingVertical: 20 }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : periods.isError ? (
        <Text style={[typography.footnote12, { color: colors.rose }]}>Could not load periods.</Text>
      ) : (
        (periods.data ?? []).map((period) => (
          <View key={period.id} style={{ marginBottom: 10 }}>
            <PeriodRow period={period} selected={current?.id === period.id} onClose={onClose} />
          </View>
        ))
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onClose();
          startUploadFlow();
        }}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', padding: 13, borderWidth: 1, borderColor: colors.hairlineDark, borderRadius: radius.card }, pressed && { opacity: 0.7 }]}
      >
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[typography.amountMedium19, { color: colors.accentInk }]}>+</Text>
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={[typography.rowLabel14, { color: colors.onDark }]}>Add a statement</Text>
          <Text style={[typography.footnote12, { color: colors.onDarkMuted }]}>Google Pay → Transaction statement → PDF</Text>
        </View>
      </Pressable>
      <Text style={[typography.microLabel11, { color: colors.onDarkFaint, textAlign: 'center', lineHeight: 16, marginTop: 16 }]}>
        Periods never overlap twice - re-uploading the same statement updates it in place.
      </Text>
    </View>
  );
}

function PeriodRow({ period, selected, onClose }: { period: Statement; selected: boolean; onClose: () => void }) {
  const live = isLive(period);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        onClose();
        if (live) {
          if (period.currentJobId) router.push(`/upload/analysing/${period.currentJobId}`);
          return;
        }
        useSession.getState().selectPeriod(period.id);
      }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 13,
          backgroundColor: selected ? colors.ink700 : colors.ink800,
          borderWidth: 1,
          borderColor: selected ? colors.accent : colors.hairlineDark,
          borderRadius: radius.card,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[typography.rowLabel145, { color: colors.onDark }]}>{formatPeriodRange(period.periodStart, period.periodEnd)}</Text>
        <View style={{ marginTop: 4 }}>
          {live ? (
            <LiveProgressLabel jobId={period.currentJobId} />
          ) : (
            <Text style={[typography.meta115, { color: colors.onDarkMuted }]}>
              {period.transactionCount} txns · {formatCurrency(period.computedSentAmount ?? period.declaredSentAmount ?? 0)} out
            </Text>
          )}
        </View>
      </View>
      {selected ? (
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="check" size={13} color={colors.accentInk} />
        </View>
      ) : (
        <MaterialIcons name="chevron-right" size={24} color={colors.onDarkFaint} />
      )}
    </Pressable>
  );
}

function LiveProgressLabel({ jobId }: { jobId: string | null }) {
  const snapshot = useJobSnapshot(jobId);
  if (!jobId) return <Text style={[typography.meta115, { color: colors.amber }]}>ANALYSING</Text>;
  const percent = snapshot.data?.progressPercent;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <PulsingDot color={colors.amber} size={5} />
      <Text style={[typography.meta115, { color: colors.amber, marginLeft: 6 }]}>{percent == null ? 'ANALYSING' : `ANALYSING · ${percent}%`}</Text>
    </View>
  );
}
