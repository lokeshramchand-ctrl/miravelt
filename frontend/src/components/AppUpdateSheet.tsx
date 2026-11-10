import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppUpdate } from '../state/appUpdate';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { PrimaryPillButton, SecondaryPillButton } from './Buttons';
import { SweepProgressBar } from './Charts';
import { MiraveltSheet } from './Sheet';

/**
 * Shown once from the tab shell when a launch-time check finds a newer release
 * than the one installed. Self-hosted equivalent of a Play Store update prompt
 * (see routers/app_updates.py).
 */
export function AppUpdateSheetHost() {
  const stage = useAppUpdate((s) => s.stage);
  const [open, setOpen] = useState(false);

  // Open the first time an update turns up; once dismissed it stays dismissed for the session.
  const [offered, setOffered] = useState(false);
  useEffect(() => {
    if (stage === 'available' && !offered) {
      setOffered(true);
      setOpen(true);
    }
  }, [stage, offered]);

  // installApk() launches Android's own installer on top of the app - once that
  // hand-off has happened there's nothing left for this sheet to show.
  useEffect(() => {
    if (stage !== 'readyToInstall') return;
    const t = setTimeout(() => setOpen(false), 400);
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <MiraveltSheet visible={open} onClose={() => setOpen(false)} dismissible={stage !== 'downloading'} dark>
      <AppUpdateBody onLater={() => setOpen(false)} />
    </MiraveltSheet>
  );
}

function AppUpdateBody({ onLater }: { onLater: () => void }) {
  const { stage, info, progressPercent, errorMessage, downloadAndInstall, cancelDownload } = useAppUpdate();
  if (!info) return null;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink700, borderWidth: 1, borderColor: colors.hairlineDark, borderRadius: radius.field }}>
          <MaterialIcons name="system-update-alt" size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[typography.rowLabel14, { color: colors.onDark, fontSize: 16 }]}>Update available</Text>
          <Text style={[typography.meta115, { color: colors.onDarkFaint, marginTop: 2 }]}>Version {info.versionName}</Text>
        </View>
      </View>
      {info.releaseNotes ? (
        <View style={{ marginTop: 16, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: colors.ink800, borderWidth: 1, borderColor: colors.hairlineDark, borderRadius: 14 }}>
          <Text style={[typography.footnote12, { color: colors.onDarkMuted, lineHeight: 18 }]}>{info.releaseNotes}</Text>
        </View>
      ) : null}
      <View style={{ height: 20 }} />
      {stage === 'downloading' ? (
        <>
          <SweepProgressBar percent={progressPercent} />
          <Text style={[typography.meta115, { color: colors.onDarkMuted, marginTop: 8 }]}>DOWNLOADING · {Math.round(progressPercent)}%</Text>
          <View style={{ height: 18 }} />
          <SecondaryPillButton label="Cancel" foreground={colors.onDarkMuted} borderColor={colors.hairlineDark} onPress={cancelDownload} />
        </>
      ) : stage === 'readyToInstall' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[typography.footnote12, { color: colors.onDarkMuted, marginLeft: 10 }]}>Opening installer…</Text>
        </View>
      ) : (
        <>
          {stage === 'error' && errorMessage ? (
            <View style={{ marginBottom: 14, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: colors.amberTint, borderRadius: 14 }}>
              <Text style={[typography.footnote12, { color: colors.amberTextOnTint }]}>{errorMessage}</Text>
            </View>
          ) : null}
          <PrimaryPillButton label="Update now" onPress={() => void downloadAndInstall()} />
          <View style={{ height: 10 }} />
          <SecondaryPillButton label="Later" foreground={colors.onDarkMuted} borderColor={colors.hairlineDark} onPress={onLater} />
        </>
      )}
    </View>
  );
}
