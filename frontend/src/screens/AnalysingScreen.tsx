import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Confetti, PopIn } from '../components/Delight';
import { DotWave, useElapsed } from '../components/Live';
import { formatElapsed } from '../lib/format';
import { haptics } from '../lib/haptics';
import { PrimaryPillButton, SecondaryPillButton } from '../components/Buttons';
import { ProgressRing, PulsingDot } from '../components/Charts';
import { Screen } from '../components/Screen';
import { invalidatePeriods, useJobPoll } from '../hooks/periods';
import { requestNotificationPermission, showJobDone } from '../lib/notifications';
import { alertUnusualSpendIfEnabled } from '../lib/unusualSpend';
import { useSession } from '../state/session';
import { useSettings } from '../state/settings';
import { showToast } from '../state/toast';
import { colors } from '../theme/colors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

export const STAGE_LABELS = ['Reading your statement', 'Naming merchants', 'Profiling behaviour', 'Computing analytics', 'Writing your signals'] as const;

/** Which of the pipeline stages is "active" at `progress` percent (the rest before it are done). */
export function activeStageIndex(progress: number): number {
  return Math.min(STAGE_LABELS.length - 1, Math.max(0, Math.floor((progress / 100) * STAGE_LABELS.length)));
}

export default function AnalysingScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [notifyRequested, setNotifyRequested] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const notifiedDone = useRef(false);
  const completionHandled = useRef(false);

  // Profile > "Analysis finished" is the standing opt-in; the button below stays
  // as the one-off opt-in for someone who has it switched off.
  useEffect(() => {
    if (!useSettings.getState().notifyAnalysisFinished) return;
    let live = true;
    void requestNotificationPermission().then((granted) => {
      if (live && granted) setNotifyRequested(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const { job, error, loading } = useJobPoll(jobId);

  const requestNotify = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotifyRequested(true);
      showToast("We'll notify you when this finishes.", 'success');
    } else {
      showToast('Notifications are turned off for Miravelt in system settings.', 'error');
    }
  };

  const status = job?.status;
  const resourceId = job?.resourceId;
  useEffect(() => {
    if (status !== 'COMPLETED' && status !== 'FAILED') return;
    const failed = status === 'FAILED';
    if (notifyRequested && !notifiedDone.current) {
      notifiedDone.current = true;
      void showJobDone(
        failed ? 'Statement processing failed' : 'Your statement is ready',
        failed ? "We couldn't finish analysing your statement." : "We've found your top merchant and biggest signal.",
      );
    }
    if (!failed && resourceId && !completionHandled.current) {
      completionHandled.current = true;
      void alertUnusualSpendIfEnabled(resourceId);
      useSession.getState().selectPeriod(resourceId);
      void invalidatePeriods();
      // A beat of celebration before Overview takes over.
      haptics.success();
      setCelebrate((c) => c + 1);
      setTimeout(() => router.replace('/overview'), 1300);
    }
    if (failed) haptics.error();
  }, [status, resourceId, notifyRequested]);

  const progress = job?.progressPercent ?? 0;
  const activeIndex = activeStageIndex(progress);
  // Elapsed since the worker picked the job up (or since it was queued). Device and server
  // clocks can disagree a little; formatElapsed never shows a negative.
  const startedMs = (job?.startedAt ?? job?.createdAt)?.getTime() ?? null;
  const elapsed = useElapsed(startedMs, status !== 'COMPLETED' && status !== 'FAILED');

  return (
    <Screen dark>
      <View style={{ flex: 1, paddingHorizontal: spacing.gutter, paddingTop: 14, paddingBottom: 30 }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.signal} />
          </View>
        ) : error ? (
          <ErrorBody message={error.message} />
        ) : job?.status === 'FAILED' ? (
          <ErrorBody message={job.errorMessage ?? "This statement couldn't be processed."} />
        ) : job ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.rowLabel14, { color: colors.text }]}>Your statement</Text>
              <Text style={[typography.microLabel11, { color: colors.faint }]} accessibilityLabel={`Running in background, ${formatElapsed(elapsed)} elapsed`}>
                RUNNING IN BACKGROUND · {formatElapsed(elapsed)}
              </Text>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={{ height: 28 }} />
              <View style={{ alignItems: 'center' }}>
                <ProgressRing
                  percent={progress}
                  centerLabel={
                    <Text>
                      <Text style={[typography.heroAmount34, { color: colors.text }]}>{Math.round(progress)}</Text>
                      <Text style={[typography.amountMedium20, { color: colors.text }]}>%</Text>
                    </Text>
                  }
                  centerSubLabel={job.stage?.toUpperCase()}
                />
              </View>
              <Text style={[typography.bigHeadline22, { color: colors.text, textAlign: 'center', marginTop: 28 }]}>Finding your patterns</Text>
              <Text style={[typography.footnote15, { color: colors.muted, textAlign: 'center', marginTop: 10 }]}>Profiling merchant behaviour - how often you pay them, and how much is normal.</Text>
              <View style={{ height: 26 }} />
              {STAGE_LABELS.map((label, i) => (
                <StageRow key={label} index={i} label={label} state={i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending'} />
              ))}
            </ScrollView>
            <View style={{ marginTop: 14, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 }}>
              <Text style={[typography.footnote12, { color: colors.muted }]}>We'll show your top merchant and biggest signal the moment this finishes.</Text>
            </View>
            <View style={{ height: 14 }} />
            <SecondaryPillButton
              label={notifyRequested ? "We'll notify you" : "Notify me when it's done"}
              foreground={colors.text}
              borderColor={colors.border}
              onPress={notifyRequested ? undefined : requestNotify}
            />
          </>
        ) : null}
      </View>
      <Confetti fire={celebrate} />
    </Screen>
  );
}

type StageState = 'done' | 'active' | 'pending';

/**
 * A pipeline stage as a live task row (beautifului.dev's task rows): the check pops in when a
 * stage finishes, the active stage carries a dot wave, pending ones wait dimmed.
 */
function StageRow({ index, label, state }: { index: number; label: string; state: StageState }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${state === 'done' ? 'done' : state === 'active' ? 'in progress' : 'waiting'}`}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, opacity: state === 'pending' ? 0.4 : 1 }}
    >
      {state === 'done' ? (
        <PopIn delay={index * 60}>
          <Icon name="check-circle" size={18} color={colors.signal} />
        </PopIn>
      ) : state === 'active' ? (
        <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.signal }} />
          <PulsingDot color={colors.signal} size={7} />
        </View>
      ) : (
        <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.faint }} />
      )}
      <Text style={[state === 'active' ? typography.rowLabel14 : typography.body13, { color: colors.text, marginLeft: 12, flex: 1 }]}>{label}</Text>
      {state === 'active' ? <DotWave color={colors.muted} size={4} /> : state === 'done' ? <Text style={[typography.microLabel11, { color: colors.faint }]}>Done</Text> : null}
    </View>
  );
}

function ErrorBody({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="error-outline" size={40} color={colors.down} />
      <Text style={[typography.footnote15, { color: colors.muted, textAlign: 'center', marginTop: 16 }]}>{message}</Text>
      <View style={{ marginTop: 20 }}>
        <PrimaryPillButton label="Back to overview" expand={false} onPress={() => router.replace('/overview')} />
      </View>
    </View>
  );
}
