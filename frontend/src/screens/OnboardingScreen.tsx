import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button3D, ChunkyProgress, Confetti, Mascot, PopIn, SpeechBubble, useShake } from '../components/Delight';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { nativeDriver } from '../components/motion';
import { Screen } from '../components/Screen';
import { haptics } from '../lib/haptics';
import { useSettings } from '../state/settings';
import type { Goal } from '../state/settings';
import { startUploadFlow } from '../state/upload';
import { colors } from '../theme/colors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'file-pdf', title: 'Open Google Pay', body: 'Tap your profile picture, then "Transaction statement".' },
  { icon: 'calendar', title: 'Export the PDF', body: 'Pick any date range - six months tells the best story - and download it.' },
  { icon: 'export', title: 'Add it here', body: 'Tap the button below and choose the PDF. Analysis takes under a minute.' },
];

/** Zigzag offsets for the lesson path, like Duolingo's winding trail. */
const OFFSETS = [-46, 40, -20, 30];

/** What Miro says first, picked from the goals chosen on the welcome tour. */
export function onboardingLine(goals: readonly Goal[]): string {
  if (goals.includes('food')) return "Let's find out where your food money really goes!";
  if (goals.includes('subscriptions')) return "Let's hunt down those repeat payments together!";
  if (goals.includes('save')) return "Let's see how much you're keeping each month!";
  if (goals.includes('unusual')) return "Let's learn your normal, so I can spot the unusual.";
  return "Let's add your first statement. Three quick steps!";
}

/**
 * First-statement screen (signed in, no periods yet). A lesson path: three steps as chunky
 * nodes on a winding trail, the current one bouncing a START flag. Tap a node to read it and
 * tick it off; the trophy at the end, and the button underneath, open the upload.
 * Doubles as Overview's empty state when the user has zero periods.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const goals = useSettings((s) => s.goals);
  const [done, setDone] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [hop, setHop] = useState(0);
  const [confetti, setConfetti] = useState(0);
  const [nudge, setNudge] = useState<string | null>(null);

  const complete = (i: number) => {
    setOpen(null);
    if (i === done) {
      haptics.success();
      setDone(i + 1);
      setHop((h) => h + 1);
      if (i + 1 === STEPS.length) setConfetti((c) => c + 1);
    }
  };

  const bubble = nudge ?? (done === 0 ? onboardingLine(goals) : done < STEPS.length ? ['Nice one! Keep going.', "You're on a roll!"][done - 1] : 'All set - tap the trophy and add your PDF!');

  return (
    <Screen safeBottom>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.gutter, paddingTop: 10 }}>
        <Text style={[typography.wordmark14, { color: colors.text, fontSize: 17 }]}>Miravelt</Text>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <Icon name="bolt" size={14} color={colors.text} />
          <Text style={[typography.metaBold12, { color: colors.text, marginLeft: 5 }]}>
            {done}/{STEPS.length}
          </Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.gutter, marginTop: 12 }}>
        <ChunkyProgress value={done / STEPS.length} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Mascot size={70} hop={hop} />
          <SpeechBubble text={bubble} style={{ flex: 1, marginLeft: 14, marginTop: 6 }} />
        </View>

        <View style={{ alignItems: 'center', marginTop: 48 }}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={{ alignItems: 'center' }}>
              <View style={{ transform: [{ translateX: OFFSETS[i] }] }}>
                <PathNode
                  icon={done > i ? 'check' : s.icon}
                  state={done > i ? 'done' : done === i ? 'current' : 'next'}
                  delay={i * 120}
                  onPress={() => {
                    if (i > done) {
                      setNudge(`One at a time! Start with step ${done + 1}.`);
                      setHop((h) => h + 1);
                      return;
                    }
                    haptics.tap();
                    setNudge(null);
                    setOpen(open === i ? null : i);
                  }}
                />
              </View>
              {open === i ? (
                <StepCard step={s} index={i} done={done > i} onDone={() => complete(i)} />
              ) : (
                <Dots from={OFFSETS[i]} to={OFFSETS[i + 1]} />
              )}
            </View>
          ))}
          <View style={{ transform: [{ translateX: OFFSETS[3] }] }}>
            <Trophy ready={done >= STEPS.length} onPress={() => (haptics.tap(), startUploadFlow())} />
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.gutter, paddingTop: 10, paddingBottom: 12 + insets.bottom, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Button3D label="Add your first statement" icon="plus" onPress={startUploadFlow} />
        <Text style={[typography.footnote1155, { color: colors.faint, textAlign: 'center', marginTop: 10 }]}>Stays on your account. Never shared, never sold.</Text>
      </View>
      <Confetti fire={confetti} />
    </Screen>
  );
}

function PathNode({ icon, state, delay, onPress }: { icon: IconName; state: 'done' | 'current' | 'next'; delay: number; onPress: () => void }) {
  const press = useRef(new Animated.Value(0)).current;
  const { shake, style: shakeStyle } = useShake();
  const ring = useRef(new Animated.Value(0)).current;
  const flag = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (state !== 'current') return;
    const r = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }));
    const f = Animated.loop(
      Animated.sequence([
        Animated.timing(flag, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
        Animated.timing(flag, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
      ]),
    );
    r.start();
    f.start();
    return () => {
      r.stop();
      f.stop();
    };
  }, [state, ring, flag]);
  const palette =
    state === 'done'
      ? { face: '#a9f19d', lip: '#6fcf5f', fg: '#14400d' }
      : state === 'current'
        ? { face: colors.ink, lip: colors.scheme === 'dark' ? '#9aa1a9' : '#000000', fg: colors.onInk }
        : { face: colors.scheme === 'dark' ? '#2a2f36' : '#ffffff', lip: colors.border2, fg: colors.faint };
  const S = 74;
  return (
    <PopIn delay={delay}>
      {state === 'current' ? (
        <Animated.View style={{ position: 'absolute', top: -40, alignSelf: 'center', transform: [{ translateY: flag.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }], zIndex: 2 }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.scheme === 'dark' ? '#23272d' : '#ffffff', borderWidth: 1.5, borderColor: colors.border2 }}>
            <Text style={[typography.badge10, { color: colors.text, fontFamily: 'Inter_700Bold', letterSpacing: 0.6 }]}>START</Text>
          </View>
          <View style={{ alignSelf: 'center', marginTop: -6, width: 10, height: 10, backgroundColor: colors.scheme === 'dark' ? '#23272d' : '#ffffff', borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.border2, transform: [{ rotate: '45deg' }] }} />
        </Animated.View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={state === 'done' ? 'Step done' : state === 'current' ? 'Open step' : 'Locked step'}
        onPressIn={() => Animated.timing(press, { toValue: 1, duration: 60, useNativeDriver: nativeDriver }).start()}
        onPressOut={() => Animated.timing(press, { toValue: 0, duration: 140, useNativeDriver: nativeDriver }).start()}
        onPress={() => {
          if (state === 'next') shake();
          onPress();
        }}
        style={{ width: S, height: S + 6 }}
      >
        <Animated.View style={[{ width: S, height: S + 6 }, shakeStyle]}>
        {state === 'current' ? (
          <Animated.View
            style={{
              position: 'absolute',
              width: S,
              height: S,
              borderRadius: S / 2,
              borderWidth: 3,
              borderColor: colors.ink,
              opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
            }}
          />
        ) : null}
        <View style={{ position: 'absolute', bottom: 0, width: S, height: S, borderRadius: S / 2, backgroundColor: palette.lip }} />
        <Animated.View
          style={{
            width: S,
            height: S,
            borderRadius: S / 2,
            backgroundColor: palette.face,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: state === 'next' ? 1.5 : 0,
            borderColor: colors.border2,
            transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }],
          }}
        >
          <Icon name={state === 'next' ? 'lock' : icon} size={state === 'next' ? 26 : 30} color={palette.fg} />
        </Animated.View>
        </Animated.View>
      </Pressable>
    </PopIn>
  );
}

function Dots({ from, to }: { from: number; to: number }) {
  return (
    <View style={{ height: 46, justifyContent: 'center' }}>
      {[0, 1, 2].map((k) => (
        <View key={k} style={{ width: 8, height: 8, borderRadius: 4, marginVertical: 3, backgroundColor: colors.border2, transform: [{ translateX: from + ((to - from) * (k + 1)) / 4 }] }} />
      ))}
    </View>
  );
}

function StepCard({ step, index, done, onDone }: { step: (typeof STEPS)[number]; index: number; done: boolean; onDone: () => void }) {
  return (
    <PopIn style={{ alignSelf: 'stretch', marginVertical: 14 }}>
      <View style={{ alignSelf: 'center', width: 16, height: 16, marginBottom: -9, backgroundColor: colors.ink, transform: [{ rotate: '45deg' }] }} />
      <View style={{ padding: 18, borderRadius: 22, backgroundColor: colors.ink }}>
        <Text style={[typography.footnote1155, { color: colors.scheme === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)' }]}>Step {index + 1} of {STEPS.length}</Text>
        <Text style={[typography.bigHeadline22, { color: colors.onInk, marginTop: 4 }]}>{step.title}</Text>
        <Text style={[typography.body14, { color: colors.scheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.78)', marginTop: 6 }]}>{step.body}</Text>
        <View style={{ height: 14 }} />
        <Button3D label={done ? 'Done' : 'Got it'} variant={colors.scheme === 'dark' ? 'ink' : 'go'} onPress={onDone} />
      </View>
    </PopIn>
  );
}

function Trophy({ ready, onPress }: { ready: boolean; onPress: () => void }) {
  const wiggle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 120, useNativeDriver: nativeDriver }),
        Animated.timing(wiggle, { toValue: -1, duration: 120, useNativeDriver: nativeDriver }),
        Animated.timing(wiggle, { toValue: 0, duration: 120, useNativeDriver: nativeDriver }),
        Animated.delay(1400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ready, wiggle]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Add your first statement" onPress={onPress} style={{ alignItems: 'center', marginTop: 4 }}>
      <Animated.View
        style={{
          width: 92,
          height: 92,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ready ? '#ffd98a' : colors.surface,
          borderWidth: 2,
          borderColor: ready ? '#e6b04a' : colors.border2,
          transform: [{ rotate: wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) }, { scale: ready ? 1.05 : 1 }],
        }}
      >
        <Icon name="cat-income" size={40} color={ready ? '#5a3500' : colors.faint} />
      </Animated.View>
      <Text style={[typography.meta12, { color: ready ? colors.text : colors.faint, marginTop: 8 }]}>{ready ? 'Your first insights' : 'Finish the steps'}</Text>
    </Pressable>
  );
}
