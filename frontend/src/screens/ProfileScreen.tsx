import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { statementsRepository } from '../api/instance';
import { authRepository } from '../api/instance';
import { ApiException } from '../api/errors';
import { UserAvatar } from '../components/Avatars';
import { DeveloperUnlockGesture } from '../components/DeveloperSettings';
import { Dialog, PromptDialog } from '../components/Dialog';
import { PrimaryPillButton } from '../components/Buttons';
import { RowIcon, SegmentedControl, ScreenBackHeader, ToggleRow } from '../components/Controls';
import { Card as GlassCard, StatTile } from '../components/Display';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { Screen } from '../components/Screen';
import type { Transaction } from '../domain/types';
import { userInitials } from '../domain/types';
import { useCurrentPeriod, usePeriods } from '../hooks/periods';
import { transactionsToCsv } from '../lib/exportCsv';
import { requestNotificationPermission } from '../lib/notifications';
import { useAuth } from '../state/auth';
import { useSettings } from '../state/settings';
import type { ThemeMode } from '../state/settings';
import { showToast } from '../state/toast';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const THEME_OPTIONS = [['light', 'Light'], ['dark', 'Dark'], ['system', 'Auto']] as const;

/** Page through every transaction of a statement. The cap guards against a runaway loop if the backend ever reports a bad total_pages. */
async function fetchAllTransactions(statementId: string): Promise<Transaction[]> {
  const all: Transaction[] = [];
  const maxPages = 500; // 500 pages * 100/page = 50k transactions, far beyond any real statement
  for (let page = 1; page <= maxPages; page++) {
    const result = await statementsRepository.transactions(statementId, { page, pageSize: 100, sortBy: 'timestamp', sortOrder: 'desc' });
    all.push(...result.items);
    if (page >= result.totalPages) break;
  }
  return all;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const periodsQuery = usePeriods();
  const period = useCurrentPeriod();
  const settings = useSettings();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  const periods = periodsQuery.data ?? [];
  const completed = periods.filter((p) => p.processingStatus === 'COMPLETED');
  const totalTxns = completed.reduce((sum, p) => sum + p.transactionCount, 0);
  const hasName = !!user?.fullName?.trim();

  /** Switching an alert on is the moment to ask for notification permission - asking only when the alert would fire means it silently never shows. */
  const setAlert = async (set: (value: boolean) => void, enabled: boolean) => {
    set(enabled);
    if (enabled) await requestNotificationPermission();
  };

  const saveName = (value: string): string | null => {
    setEditing(false);
    const trimmed = value.trim();
    void (async () => {
      try {
        useAuth.getState().setUser(await authRepository.updateProfile(trimmed === '' ? null : trimmed));
        showToast('Name updated', 'success');
      } catch (e) {
        showToast(e instanceof ApiException ? e.message : 'Something went wrong. Please try again.', 'error');
      }
    })();
    return null;
  };

  const exportData = async () => {
    if (!period) {
      showToast('Add a statement first to export its transactions.', 'success');
      return;
    }
    setExporting(true);
    try {
      const transactions = await fetchAllTransactions(period.id);
      setExporting(false);
      await Share.share({ message: transactionsToCsv(transactions), title: `Miravelt export - ${period.originalFilename}` });
    } catch (e) {
      setExporting(false);
      showToast(e instanceof ApiException ? e.message : 'Something went wrong. Please try again.', 'error');
    }
  };

  const signOut = async () => {
    await useAuth.getState().logout();
    router.replace('/login');
  };

  return (
    <Screen dark>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: 6, paddingBottom: 28 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <ScreenBackHeader title="You" titleStyle={typography.pageTitle} />
        <View style={{ height: 18 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <UserAvatar seed={user?.id} initials={user ? userInitials(user) : '?'} size={54} gradient={[colors.signal, colors.signalText]} foregroundColor={colors.onInk} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            {/* With no name set, the email is the title - don't repeat it underneath as well. */}
            {hasName ? (
              <>
                <Text style={[typography.rowLabel14, { fontSize: 16, color: colors.text }]}>{user?.fullName}</Text>
                <Text style={[typography.meta12, { color: colors.faint, marginTop: 3 }]}>{user?.email}</Text>
              </>
            ) : (
              <Text style={[typography.rowLabel14, { fontSize: 16, color: colors.text }]}>{user?.email ?? ''}</Text>
            )}
          </View>
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 100 }}>
            <Text style={[typography.buttonLabel12, { color: colors.text }]}>Edit</Text>
          </Pressable>
        </View>
        <View style={{ height: 20 }} />
        {/* "TXNS ANALYSED" wraps on phone widths, and the three tiles should still line up as one row. */}
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <View style={{ flex: 1 }}>
            <StatTile icon="calendar" label="PERIODS" value={`${periods.length}`} />
          </View>
          <View style={{ width: 10 }} />
          <View style={{ flex: 1 }}>
            <StatTile icon="receipt-long" label="TXNS ANALYSED" value={`${totalTxns}`} />
          </View>
          <View style={{ width: 10 }} />
          <View style={{ flex: 1 }}>
            <StatTile icon="check-circle" label="COMPLETED" value={`${completed.length}`} />
          </View>
        </View>

        <SectionLabel>DATA</SectionLabel>
        <Card>
          <NavRow icon="calendar" title="Manage periods" trailing={`${periods.length} ›`} onPress={() => router.push('/profile/periods')} />
          <Divider />
          <NavRow icon="chart-bar" title="Spending patterns" trailing="›" onPress={() => router.push('/profile/analytics')} />
          <Divider />
          <ToggleRow icon="file-pdf" title="Keep original PDFs" value={settings.keepOriginalPdfs} onChange={settings.setKeepOriginalPdfs} />
          <Divider />
          <NavRow icon="export" title="Export my data" trailing={exporting ? '' : '›'} busy={exporting} onPress={exportData} />
        </Card>

        <SectionLabel>APPEARANCE & ALERTS</SectionLabel>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }}>
            <RowIcon name="palette" />
            <Text style={[typography.rowLabel14, { color: colors.text, flex: 1 }]}>Theme</Text>
            <SegmentedControl<ThemeMode> value={settings.themeMode} options={THEME_OPTIONS} onChange={settings.setThemeMode} />
          </View>
          <Divider />
          <ToggleRow icon="notifications-none" title="Analysis finished" subtitle="Push when a period is ready" value={settings.notifyAnalysisFinished} onChange={(v) => void setAlert(settings.setNotifyAnalysisFinished, v)} />
          <Divider />
          <ToggleRow icon="priority-high" title="Unusual spend" subtitle="Only WATCH-level signals" value={settings.notifyUnusualSpend} onChange={(v) => void setAlert(settings.setNotifyUnusualSpend, v)} />
        </Card>

        <SectionLabel>DEVELOPER</SectionLabel>
        <Card>
          {/* Same gesture and same sheet as the login screen's footer - whichever one you find first, the other stays in sync. */}
          <DeveloperUnlockGesture>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }}>
              <RowIcon name="code" />
              <Text style={[typography.rowLabel14, { color: colors.text, flex: 1 }]}>Developer settings</Text>
              <Text style={[typography.meta12, { color: colors.faint }]}>{settings.developerModeUnlocked ? '›' : ''}</Text>
            </View>
          </DeveloperUnlockGesture>
        </Card>

        <SectionLabel>LEGAL</SectionLabel>
        <Card>
          <NavRow icon="shield-check" title="Privacy Policy" trailing="›" onPress={() => router.push('/profile/privacy')} />
          <Divider />
          <NavRow icon="file-text" title="Terms of Service" trailing="›" onPress={() => router.push('/profile/terms')} />
        </Card>

        <View style={{ height: 26 }} />
        <PrimaryPillButton label="Sign out" icon="sign-out" onPress={signOut} />
        <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={{ alignSelf: 'center', paddingVertical: 14, marginTop: 6 }}>
          <Text style={[typography.footnote12, { color: colors.down }]}>Delete account and all data</Text>
        </Pressable>
      </ScrollView>

      {editing ? <PromptDialog visible title="Edit name" initialValue={user?.fullName ?? ''} placeholder="Your name" onSubmit={saveName} onCancel={() => setEditing(false)} /> : null}
      <Dialog
        visible={confirmDelete}
        title="Delete account?"
        message="This signs you out and clears this device's local session. Full account and data deletion isn't available from the app yet - contact support to permanently delete your account."
        onRequestClose={() => setConfirmDelete(false)}
        actions={[
          { label: 'Cancel', tone: 'muted', onPress: () => setConfirmDelete(false) },
          {
            label: 'Sign out',
            tone: 'danger',
            onPress: () => {
              setConfirmDelete(false);
              void signOut();
            },
          },
        ]}
      />
    </Screen>
  );
}

function SectionLabel({ children }: { children: string }) {
  const label = children.charAt(0) + children.slice(1).toLowerCase();
  return <Text style={[typography.footnote12, { color: colors.muted, marginTop: 26, marginBottom: 10, marginLeft: 4 }]}>{label}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <GlassCard padded={false} style={{ overflow: 'hidden' }}>{children}</GlassCard>;
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

function NavRow({ title, trailing, onPress, busy = false, icon }: { title: string; trailing: string; onPress: () => void; busy?: boolean; icon?: IconName }) {
  const count = trailing.replace('›', '').trim();
  return (
    <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }, pressed && { backgroundColor: colors.surface2 }]}>
      {icon ? <RowIcon name={icon} /> : null}
      <Text style={[typography.rowLabel14, { color: colors.text, flex: 1 }]}>{title}</Text>
      {busy ? (
        <ActivityIndicator size="small" color={colors.signal} />
      ) : (
        <>
          {count ? <Text style={[typography.meta12, { color: colors.muted, marginRight: 6 }]}>{count}</Text> : null}
          {trailing.includes('›') ? <Icon name="chevron-right" size={14} color={colors.faint} /> : null}
        </>
      )}
    </Pressable>
  );
}
