import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { statementsRepository } from '../api/instance';
import { authRepository } from '../api/instance';
import { ApiException } from '../api/errors';
import { UserAvatar } from '../components/Avatars';
import { DeveloperUnlockGesture } from '../components/DeveloperSettings';
import { Dialog, PromptDialog } from '../components/Dialog';
import { FormDialog } from '../components/FormDialog';
import { PrimaryPillButton } from '../components/Buttons';
import { RowIcon, SegmentedControl, ScreenBackHeader, ToggleRow } from '../components/Controls';
import { Card as GlassCard, StatTile } from '../components/Display';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { Screen } from '../components/Screen';
import type { Transaction } from '../domain/types';
import { userInitials } from '../domain/types';
import { useCurrentPeriod, usePeriods } from '../hooks/periods';
import { errorCode } from '../api/errors';
import { lockAvailability, authenticate } from '../lib/appLock';
import { shareCsvFile, shareJsonFile, transactionsToCsv } from '../lib/exportCsv';
import { validateNewPassword } from './ForgotPasswordScreen';
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
  const [exportingAll, setExportingAll] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);

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
      await shareCsvFile(transactionsToCsv(transactions), `miravelt-${period.originalFilename}`);
    } catch (e) {
      setExporting(false);
      showToast(e instanceof ApiException ? e.message : 'Something went wrong. Please try again.', 'error');
    }
  };

  const signOut = async () => {
    await useAuth.getState().logout();
    router.replace('/login');
  };

  /** Everything the backend holds about the account, as one JSON file (D3). */
  const exportEverything = async () => {
    setExportingAll(true);
    try {
      const data = await authRepository.exportAll();
      setExportingAll(false);
      await shareJsonFile(data, 'miravelt-all-my-data');
    } catch (e) {
      setExportingAll(false);
      showToast(e instanceof ApiException ? e.message : 'Something went wrong. Please try again.', 'error');
    }
  };

  const changePassword = async (values: Record<string, string>): Promise<string | null> => {
    const current = values.current ?? '';
    if (!current) return 'Enter your current password';
    const found = validateNewPassword(values.next ?? '', values.confirm ?? '');
    if (found.password || found.confirm) return found.password ?? found.confirm ?? null;
    try {
      await authRepository.changePassword(current, values.next);
      setChangingPassword(false);
      showToast('Password changed. Other devices were signed out.', 'success');
      return null;
    } catch (e) {
      return errorCode(e) === 'wrong_password' ? 'That is not your current password' : e instanceof ApiException ? e.message : 'Something went wrong. Please try again.';
    }
  };

  /** Permanent, server-side (F18): the account and every statement, transaction and correction. */
  const deleteAccount = async (values: Record<string, string>): Promise<string | null> => {
    if (!values.password) return 'Enter your password to confirm';
    try {
      await useAuth.getState().deleteAccount(values.password);
      setConfirmDelete(false);
      showToast('Your account and all its data were deleted.', 'success');
      router.replace('/login');
      return null;
    } catch (e) {
      return errorCode(e) === 'wrong_password' ? 'That password is not right' : e instanceof ApiException ? e.message : 'Something went wrong. Please try again.';
    }
  };

  const startEmailVerification = async () => {
    try {
      const sent = await authRepository.requestEmailVerification();
      if (sent) setVerifying(true);
      else showToast('This server cannot send email yet, so the address cannot be verified.', 'error');
    } catch (e) {
      showToast(e instanceof ApiException ? e.message : 'Something went wrong. Please try again.', 'error');
    }
  };

  const confirmEmail = async (values: Record<string, string>): Promise<string | null> => {
    const code = (values.code ?? '').trim();
    if (!/^\d{6}$/.test(code)) return 'Enter the 6-digit code from the email';
    try {
      useAuth.getState().setUser(await authRepository.verifyEmail(code));
      setVerifying(false);
      showToast('Email verified.', 'success');
      return null;
    } catch (e) {
      return errorCode(e) === 'invalid_code' ? 'That code is wrong or has expired' : e instanceof ApiException ? e.message : 'Something went wrong. Please try again.';
    }
  };

  /** Turning the lock on is proven with the lock itself, so nobody is locked out by a phone with no screen lock. */
  const setAppLock = async (enabled: boolean) => {
    if (!enabled) {
      settings.setAppLockEnabled(false);
      return;
    }
    const availability = await lockAvailability();
    if (availability !== 'available') {
      showToast(availability === 'not-enrolled' ? 'Set a screen lock or fingerprint in your phone settings first.' : 'This device has no screen lock to use.', 'error');
      return;
    }
    if (await authenticate('Confirm it is you to turn on app lock')) settings.setAppLockEnabled(true);
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
          <NavRow icon="user" title="People" trailing="›" onPress={() => router.push('/people')} />
          <Divider />
          <NavRow icon="auto-awesome" title="Teach Miravelt" trailing="›" onPress={() => router.push('/teach')} />
          <Divider />
          <NavRow icon="export" title="Export this period (CSV)" trailing={exporting ? '' : '›'} busy={exporting} onPress={exportData} />
          <Divider />
          <NavRow icon="folder-open" title="Export everything (JSON)" trailing={exportingAll ? '' : '›'} busy={exportingAll} onPress={exportEverything} />
        </Card>

        <SectionLabel>SECURITY & PRIVACY</SectionLabel>
        <Card>
          <NavRow icon="lock" title="Change password" trailing="›" onPress={() => setChangingPassword(true)} />
          <Divider />
          <ToggleRow icon="shield-check" title="App lock" subtitle="Fingerprint, face or PIN to open" value={settings.appLockEnabled} onChange={(v) => void setAppLock(v)} />
          <Divider />
          {user?.emailVerified ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }}>
              <RowIcon name="envelope" />
              <Text style={[typography.rowLabel14, { color: colors.text, flex: 1 }]}>Email verified</Text>
              <Icon name="check-circle" size={16} color={colors.signal} />
            </View>
          ) : (
            <NavRow icon="envelope" title="Verify your email" trailing="›" onPress={() => void startEmailVerification()} />
          )}
          <Divider />
          <ToggleRow icon="pulse" title="Crash reports and usage" subtitle="Sent to Miravelt only. Never your transactions" value={settings.shareDiagnostics} onChange={settings.setShareDiagnostics} />
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
      {confirmDelete ? (
        <FormDialog
          visible
          danger
          title="Delete account?"
          message="This permanently deletes your account and everything in it: every statement, transaction, correction and note, on our servers and on this phone. It cannot be undone."
          fields={[{ key: 'password', label: 'Your password', placeholder: 'Password', secure: true }]}
          submitLabel="Delete everything"
          onSubmit={deleteAccount}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
      {changingPassword ? (
        <FormDialog
          visible
          title="Change password"
          message="Other devices are signed out. This one stays signed in."
          fields={[
            { key: 'current', label: 'Current password', secure: true },
            { key: 'next', label: 'New password', placeholder: 'At least 8 characters', secure: true },
            { key: 'confirm', label: 'Repeat new password', secure: true },
          ]}
          submitLabel="Change"
          onSubmit={changePassword}
          onCancel={() => setChangingPassword(false)}
        />
      ) : null}
      {verifying ? (
        <FormDialog
          visible
          title="Verify your email"
          message={`We sent a 6-digit code to ${user?.email ?? 'your email'}.`}
          fields={[{ key: 'code', label: 'Code', placeholder: '123456', keyboardType: 'number-pad', maxLength: 6 }]}
          submitLabel="Verify"
          onSubmit={confirmEmail}
          onCancel={() => setVerifying(false)}
        />
      ) : null}
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
