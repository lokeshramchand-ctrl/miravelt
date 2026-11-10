import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
      router.replace('/overview');
    }
  }, [status, resourceId, notifyRequested]);

  const progress = job?.progressPercent ?? 0;
  const activeIndex = activeStageIndex(progress);

  return (
    <Screen dark>
      <LinearGradient colors={[colors.analysingGlowCenter, colors.ink900]} locations={[0, 0.62]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.75 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ flex: 1, paddingHorizontal: spacing.gutter, paddingTop: 14, paddingBottom: 30 }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : error ? (
          <ErrorBody message={error.message} />
        ) : job?.status === 'FAILED' ? (
          <ErrorBody message={job.errorMessage ?? "This statement couldn't be processed."} />
        ) : job ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.rowLabel14, { color: colors.onDark }]}>Your statement</Text>
              <Text style={[typography.microLabel11, { color: colors.onDarkFaint }]}>RUNNING IN BACKGROUND</Text>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={{ height: 28 }} />
              <View style={{ alignItems: 'center' }}>
                <ProgressRing
                  percent={progress}
                  centerLabel={
                    <Text>
                      <Text style={[typography.heroAmount34, { color: colors.onDark }]}>{Math.round(progress)}</Text>
                      <Text style={[typography.amountMedium20, { color: colors.onDark }]}>%</Text>
                    </Text>
                  }
                  centerSubLabel={job.stage?.toUpperCase()}
                />
              </View>
              <Text style={[typography.bigHeadline22, { color: colors.onDark, textAlign: 'center', marginTop: 28 }]}>Finding your patterns</Text>
              <Text style={[typography.footnote15, { color: colors.onDarkMuted, textAlign: 'center', marginTop: 10 }]}>Profiling merchant behaviour - how often you pay them, and how much is normal.</Text>
              <View style={{ height: 26 }} />
              {STAGE_LABELS.map((label, i) => (
                <StageRow key={label} label={label} state={i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending'} />
              ))}
            </ScrollView>
            <View style={{ marginTop: 14, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: colors.ink850, borderWidth: 1, borderColor: colors.hairlineDark, borderRadius: 14 }}>
              <Text style={[typography.footnote12, { color: colors.onDarkMuted }]}>We'll show your top merchant and biggest signal the moment this finishes.</Text>
            </View>
            <View style={{ height: 14 }} />
            <SecondaryPillButton
              label={notifyRequested ? "We'll notify you" : "Notify me when it's done"}
              foreground={colors.onDark}
              borderColor={colors.hairlineDark}
              onPress={notifyRequested ? undefined : requestNotify}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

type StageState = 'done' | 'active' | 'pending';

function StageRow({ label, state }: { label: string; state: StageState }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, opacity: state === 'pending' ? 0.4 : 1 }}>
      {state === 'done' ? (
        <MaterialIcons name="check-circle" size={18} color={colors.accent} />
      ) : state === 'active' ? (
        <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.accent }} />
          <PulsingDot color={colors.accent} size={7} />
        </View>
      ) : (
        <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.onDarkFaint }} />
      )}
      <Text style={[state === 'active' ? typography.rowLabel14 : typography.body13, { color: colors.onDark, marginLeft: 12 }]}>{label}</Text>
    </View>
  );
}

function ErrorBody({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialIcons name="error-outline" size={40} color={colors.rose} />
      <Text style={[typography.footnote15, { color: colors.onDarkMuted, textAlign: 'center', marginTop: 16 }]}>{message}</Text>
      <View style={{ marginTop: 20 }}>
        <PrimaryPillButton label="Back to overview" expand={false} onPress={() => router.replace('/overview')} />
      </View>
    </View>
  );
}
