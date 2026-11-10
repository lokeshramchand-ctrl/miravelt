import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Icon } from './Icon';
import { monthAbbr } from '../lib/format';
import { looksLikePasswordIssue, useUpload } from '../state/upload';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { PrimaryPillButton, SecondaryPillButton } from './Buttons';
import { SweepProgressBar } from './Charts';
import { MiraveltSheet } from './Sheet';
import type { Statement } from '../domain/types';

/** `PERIOD JAN 1 - JUN 30 2026 · SENT ₹1,234 · RECEIVED ₹5,678` */
export function summaryLine(statement: Statement): string {
  const { periodStart: start, periodEnd: end } = statement;
  const parts = [`PERIOD ${monthAbbr(start.getMonth() + 1)} ${start.getDate()} - ${monthAbbr(end.getMonth() + 1)} ${end.getDate()} ${end.getFullYear()}`];
  if (statement.declaredSentAmount != null) parts.push(`SENT ₹${statement.declaredSentAmount.toFixed(0)}`);
  if (statement.declaredReceivedAmount != null) parts.push(`RECEIVED ₹${statement.declaredReceivedAmount.toFixed(0)}`);
  return parts.join(' · ');
}

/**
 * The Uploading sheet, hosted once at the app root and opened by
 * `startUploadFlow()`: opens the file picker, shows progress, then routes to
 * Analysing/Rejected as the upload resolves.
 */
export function UploadSheetHost() {
  const open = useUpload((s) => s.sheetOpen);
  const close = useUpload((s) => s.closeSheet);
  return (
    <MiraveltSheet visible={open} onClose={() => {}} dismissible={false} dark>
      {open ? <UploadSheetBody onClose={close} /> : null}
    </MiraveltSheet>
  );
}

function UploadSheetBody({ onClose }: { onClose: () => void }) {
  const state = useUpload();
  const [password, setPassword] = useState('');
  const started = useRef(false);

  // Pick on open. Cancelling the native picker leaves the stage idle and closes the sheet.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void useUpload
      .getState()
      .pickAndUpload()
      .then(() => {
        if (useUpload.getState().stage === 'idle') onClose();
      });
  }, [onClose]);

  const needsPassword = state.stage === 'rejected' && looksLikePasswordIssue(state.errorMessage);

  // Route on resolution transitions.
  useEffect(() => {
    if (state.stage === 'recognized' && state.jobId) {
      const jobId = state.jobId;
      const t = setTimeout(() => {
        onClose();
        router.push(`/upload/analysing/${jobId}`);
      }, 700);
      return () => clearTimeout(t);
    }
    if (state.stage === 'rejected' && !needsPassword) {
      onClose();
      router.push({ pathname: '/upload/rejected', params: { message: state.errorMessage ?? '' } });
    }
  }, [state.stage, state.jobId, state.errorMessage, needsPassword, onClose]);

  const cancel = () => {
    useUpload.getState().cancel();
    onClose();
  };

  if (state.stage === 'idle') {
    return (
      <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.signal} />
      </View>
    );
  }

  const sizeLabel = state.fileSizeBytes == null ? '' : `${(state.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.field }}>
          <Text style={[typography.badge10, { color: colors.muted }]}>PDF</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text numberOfLines={1} style={[typography.rowLabel14, { color: colors.text }]}>
            {state.fileName ?? ''}
          </Text>
          <Text style={[typography.meta115, { color: colors.faint, marginTop: 2 }]}>{sizeLabel}</Text>
        </View>
        {state.stage === 'uploading' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel upload" onPress={cancel} hitSlop={10} style={{ padding: 8 }}>
            <Icon name="close" size={18} color={colors.faint} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ height: 16 }} />

      {state.stage === 'uploading' ? (
        <>
          <SweepProgressBar percent={state.progressPercent} />
          <Text style={[typography.meta115, { color: colors.muted, marginTop: 8 }]}>UPLOADING · {Math.round(state.progressPercent)}%</Text>
          <View style={{ marginTop: 20, paddingHorizontal: 15, paddingVertical: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 14 }}>
            <Text style={[typography.footnote12, { color: colors.muted }]}>Encrypted PDF? We'll ask for the password before parsing - it is never stored.</Text>
          </View>
          <View style={{ height: 18 }} />
          <SecondaryPillButton label="Cancel upload" foreground={colors.muted} borderColor={colors.border} onPress={cancel} />
        </>
      ) : null}

      {state.stage === 'recognized' ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 15, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 16 }}>
          <Icon name="check-circle" size={18} color={colors.signal} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[typography.rowLabel14, { color: colors.text }]}>Recognised as a Google Pay statement</Text>
            {state.statement ? <Text style={[typography.meta115, { color: colors.muted, marginTop: 6 }]}>{summaryLine(state.statement)}</Text> : null}
          </View>
        </View>
      ) : null}

      {needsPassword ? (
        <>
          <View style={{ padding: 15, backgroundColor: colors.warnSoft, borderRadius: 14 }}>
            <Text style={[typography.footnote12, { color: colors.warn }]}>{state.errorMessage || 'This PDF needs a password.'}</Text>
          </View>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="PDF password"
            placeholderTextColor={colors.faint}
            selectionColor={colors.signal}
            style={[typography.body14, { marginTop: 14, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.surface2, color: colors.text }]}
          />
          <View style={{ height: 14 }} />
          <PrimaryPillButton label="Try again" onPress={() => void useUpload.getState().retryWithPassword(password)} />
          <Pressable accessibilityRole="button" onPress={cancel} style={{ alignSelf: 'center', paddingVertical: 12 }}>
            <Text style={[typography.footnote12, { color: colors.faint }]}>Cancel</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

