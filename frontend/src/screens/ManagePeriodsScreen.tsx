import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { statementsRepository } from '../api/instance';
import { ApiException } from '../api/errors';
import { ScreenBackHeader } from '../components/Controls';
import { Dialog } from '../components/Dialog';
import { EmptyState, ErrorRetry, FadeInUpCard } from '../components/Display';
import { Screen } from '../components/Screen';
import { SkeletonBox } from '../components/Skeleton';
import type { Statement } from '../domain/types';
import { invalidatePeriods, usePeriods } from '../hooks/periods';
import { formatPeriodRange } from '../lib/format';
import { showToast } from '../state/toast';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

export default function ManagePeriodsScreen() {
  const periods = usePeriods();
  return (
    <Screen dark>
      <View style={{ paddingHorizontal: spacing.gutter, paddingTop: 6 }}>
        <ScreenBackHeader title="Manage periods" />
      </View>
      <View style={{ flex: 1 }}>
        {periods.isPending ? (
          <View style={{ padding: spacing.gutter }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <SkeletonBox width="100%" height={68} radius={radius.card} dark />
              </View>
            ))}
          </View>
        ) : periods.isError ? (
          <ErrorRetry dark message="Could not load periods." onRetry={() => void periods.refetch()} />
        ) : periods.data.length === 0 ? (
          <EmptyState dark icon="folder-open" title="No periods yet" subtitle="Statements you add will show up here." />
        ) : (
          <FlatList
            data={periods.data}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: spacing.gutter }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item, index }) => <PeriodTile period={item} entranceDelayMs={Math.min(6, index) * 40} />}
          />
        )}
      </View>
    </Screen>
  );
}

function PeriodTile({ period, entranceDelayMs }: { period: Statement; entranceDelayMs: number }) {
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const label = formatPeriodRange(period.periodStart, period.periodEnd);

  const remove = async () => {
    setConfirming(false);
    setDeleting(true);
    try {
      await statementsRepository.delete(period.id);
      await invalidatePeriods();
      showToast(`${period.originalFilename} deleted`, 'success');
    } catch (e) {
      setDeleting(false);
      showToast(e instanceof ApiException ? e.message : 'Something went wrong. Please try again.', 'error');
    }
  };

  return (
    <>
      <FadeInUpCard delay={entranceDelayMs} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.ink850, borderWidth: 1, borderColor: colors.hairlineDark, borderRadius: radius.card }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.rowLabel145, { color: colors.onDark }]}>{label}</Text>
          <Text style={[typography.meta115, { color: colors.onDarkFaint, marginTop: 4 }]}>
            {period.originalFilename} · {period.transactionCount} txns
          </Text>
        </View>
        {deleting ? (
          <ActivityIndicator size="small" color={colors.rose} />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${label}`} onPress={() => setConfirming(true)} hitSlop={10} style={{ padding: 6 }}>
            <MaterialIcons name="delete-outline" size={20} color={colors.rose} />
          </Pressable>
        )}
      </FadeInUpCard>
      <Dialog
        visible={confirming}
        title="Delete this period?"
        message={`This permanently deletes ${period.originalFilename} and all ${period.transactionCount} of its transactions. This cannot be undone.`}
        onRequestClose={() => setConfirming(false)}
        actions={[
          { label: 'Cancel', tone: 'muted', onPress: () => setConfirming(false) },
          { label: 'Delete', tone: 'danger', onPress: () => void remove() },
        ]}
      />
    </>
  );
}
