import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button3D, ChunkyProgress, Confetti, Mascot, PopIn, SpeechBubble, StepTransition, Toggle } from '../components/Delight';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { nativeDriver } from '../components/motion';
import { Screen } from '../components/Screen';
import { haptics } from '../lib/haptics';
import { requestNotificationPermission } from '../lib/notifications';
import { useSettings } from '../state/settings';
import type { Goal } from '../state/settings';
import { colors } from '../theme/colors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

export const GOAL_OPTIONS: { id: Goal; label: string; icon: IconName; reply: string }[] = [
  { id: 'where', label: 'See where my money goes', icon: 'donut-small', reply: "Great pick! I'll sort every rupee into a category." },
  { id: 'save', label: 'Keep more of what I earn', icon: 'hand-coins', reply: "Love it. I'll track how much you keep each period." },
  { id: 'subscriptions', label: 'Catch sneaky subscriptions', icon: 'repeat', reply: 'Ooh, I spot repeat payments in my sleep.' },
  { id: 'unusual', label: 'Spot unusual spending', icon: 'priority-high', reply: "I'll wave a flag when something looks off." },
  { id: 'food', label: 'Spend less on food delivery', icon: 'cat-food', reply: "Yum. I'll show you exactly where the snacks went." },
];

const HOW: { icon: IconName; title: string; body: string }[] = [
  { icon: 'file-pdf', title: 'Export a Google Pay statement', body: 'Google Pay → Transaction statement → pick any range → PDF.' },
  { icon: 'export', title: 'Add it to Miravelt', body: 'One tap. We read every transaction and name each merchant.' },
  { icon: 'auto-awesome', title: 'Get your signals', body: 'Where it went, what changed and what repeats - in about a minute.' },
];

const PROMISES: { icon: IconName; text: string }[] = [
  { icon: 'lock', text: 'No bank login, ever - only the PDF you choose' },
  { icon: 'shield-check', text: 'Every insight comes from your own numbers' },
  { icon: 'delete-outline', text: 'Delete a period, and its data, any time' },
  { icon: 'user', text: 'Never shared, never sold' },
];

const STEPS = 5; // goals, how, privacy, alerts, done (0 is the hero, not counted)

/**
 * The welcome tour, before sign-in - a Duolingo-style flow: Miro the octopus talks you through
 * it, a chunky bar shows progress, each step slides in, and the last one throws confetti. The
 * choices are real: goals personalise the first-statement screen and preset the alerts, and the
 * alert toggles are the same settings Profile shows.
 */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [goals, setGoals] = useState<Goal[]>(settings.goals);
  const [bubble, setBubble] = useState<string | null>(null);
  const [hop, setHop] = useState(0);
  const [confetti, setConfetti] = useState(0);

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setBubble(null);
    setStep(to);
    setHop((h) => h + 1);
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      go(step - 1);
      return true;
    });
    return () => sub.remove();
  });

  useEffect(() => {
    if (step === 5) {
      haptics.success();
      setConfetti((c) => c + 1);
    }
  }, [step]);

  const finish = (to: '/register' | '/login') => {
    settings.setGoals(goals);
    settings.setIntroSeen(true);
    router.replace(to);
  };

  const toggleGoal = (g: (typeof GOAL_OPTIONS)[number]) => {
    const on = goals.includes(g.id);
    haptics.select();
    setGoals(on ? goals.filter((x) => x !== g.id) : [...goals, g.id]);
    if (!on) {
      setBubble(g.reply);
      setHop((h) => h + 1);
    }
  };

  const continueFromGoals = () => {
    // "Spot unusual spending" switches that alert on; nothing else changes the defaults.
    if (goals.includes('unusual')) settings.setNotifyUnusualSpend(true);
    go(2);
  };

  const continueFromAlerts = async () => {
    if (settings.notifyAnalysisFinished || settings.notifyUnusualSpend) await requestNotificationPermission();
    go(5);
  };

  if (step === 0) return <Hero onStart={() => go(1)} onSignIn={() => finish('/login')} />;

  const prompts: Record<number, string> = {
    1: 'What would you like Miravelt to help you with? Pick as many as you like.',
    2: "Here's the plan. It takes about a minute, start to finish.",
    3: 'Your money stays yours. Here is my promise.',
    4: 'Want a nudge when something needs you?',
    5: goals.length > 0 ? "You're all set! Let's make your money make sense." : "You're all set! Let's take a look at your spending.",
  };

  return (
    <Screen safeBottom>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.gutter, paddingTop: 8, paddingBottom: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={step === 1 ? 'Close' : 'Back'} onPress={() => (haptics.tap(), go(step - 1))} hitSlop={10} style={{ marginRight: 14 }}>
          <Icon name={step === 1 ? 'close' : 'arrow-back-ios-new'} size={22} color={colors.muted} />
        </Pressable>
        <ChunkyProgress value={step / STEPS} />
      </View>

      <StepTransition stepKey={step} dir={dir}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: 14, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Mascot size={step === 5 ? 84 : 72} hop={hop} />
            <SpeechBubble text={bubble ?? prompts[step]} style={{ flex: 1, marginLeft: 14, marginTop: 6 }} />
          </View>
          <View style={{ height: 26 }} />
          {step === 1 ? <GoalsStep goals={goals} onToggle={toggleGoal} /> : null}
          {step === 2 ? <HowStep /> : null}
          {step === 3 ? <PromiseStep /> : null}
          {step === 4 ? <AlertsStep /> : null}
          {step === 5 ? <DoneStep goals={goals} /> : null}
        </ScrollView>
      </StepTransition>

      <View style={{ paddingHorizontal: spacing.gutter, paddingTop: 10, paddingBottom: 12 + insets.bottom, borderTopWidth: 1, borderTopColor: colors.border }}>
        {step === 1 ? <Button3D label="Continue" disabled={goals.length === 0} onPress={continueFromGoals} /> : null}
        {step === 2 || step === 3 ? <Button3D label={step === 2 ? 'Sounds good' : 'I trust you'} onPress={() => go(step + 1)} /> : null}
        {step === 4 ? <Button3D label="Continue" onPress={() => void continueFromAlerts()} /> : null}
        {step === 5 ? (
          <>
            <Button3D label="Create my account" onPress={() => finish('/register')} />
            <View style={{ height: 10 }} />
            <Button3D label="I already have an account" variant="ghost" onPress={() => finish('/login')} />
          </>
        ) : null}
      </View>
      <Confetti fire={confetti} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function Hero({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  const insets = useSafeAreaInsets();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 900, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: nativeDriver }).start();
  }, [rise]);
  return (
    <Screen safeBottom>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.gutter }}>
        <FloatingChips />
        <Animated.View style={{ alignItems: 'center', opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
          <SpeechBubble text="Hi! I'm Miro." tail="bottom" style={{ marginBottom: 14 }} />
          <Mascot size={132} />
          <Text style={[typography.wordmark14, { fontSize: 30, letterSpacing: -0.9, color: colors.text, marginTop: 22 }]}>Miravelt</Text>
          <Text style={[typography.footnote15, { color: colors.muted, textAlign: 'center', marginTop: 8, maxWidth: 290 }]}>The friendly way to understand where your money goes.</Text>
        </Animated.View>
      </View>
      <View style={{ paddingHorizontal: spacing.gutter, paddingBottom: 14 + insets.bottom }}>
        <Button3D label="Get started" onPress={onStart} />
        <View style={{ height: 10 }} />
        <Button3D label="I already have an account" variant="ghost" onPress={onSignIn} />
      </View>
    </Screen>
  );
}

/** Category glyphs drifting around the hero mascot. */
function FloatingChips() {
  const items: { icon: IconName; x: number; y: number; d: number }[] = [
    { icon: 'cat-food', x: -132, y: -205, d: 0 },
    { icon: 'cat-travel', x: 128, y: -175, d: 300 },
    { icon: 'cat-shopping', x: -148, y: -70, d: 600 },
    { icon: 'cat-subscription', x: 146, y: -45, d: 900 },
    { icon: 'coins', x: -112, y: 40, d: 450 },
    { icon: 'cat-bills', x: 112, y: 58, d: 750 },
  ];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: -20 }] }}>
      {items.map((it) => (
        <Drift key={it.icon} {...it} />
      ))}
    </View>
  );
}

function Drift({ icon, x, y, d }: { icon: IconName; x: number; y: number; d: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, delay: 300 + d, damping: 10, stiffness: 180, useNativeDriver: nativeDriver }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 2200 + d, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
        Animated.timing(t, { toValue: 0, duration: 2200 + d, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, pop, d]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.8)',
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pop,
        transform: [
          { translateX: x },
          { translateY: Animated.add(y, t.interpolate({ inputRange: [0, 1], outputRange: [0, -10] })) },
          { scale: pop },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) },
        ],
      }}
    >
      <Icon name={icon} size={19} color={colors.text} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

function GoalsStep({ goals, onToggle }: { goals: Goal[]; onToggle: (g: (typeof GOAL_OPTIONS)[number]) => void }) {
  return (
    <View>
      {GOAL_OPTIONS.map((g, i) => (
        <PopIn key={g.id} delay={i * 70} style={{ marginBottom: 12 }}>
          <ChoiceCard label={g.label} icon={g.icon} selected={goals.includes(g.id)} onPress={() => onToggle(g)} />
        </PopIn>
      ))}
    </View>
  );
}

/** A Duolingo answer card: a lip underneath that the card presses into, a check that pops when picked. */
function ChoiceCard({ label, icon, selected, onPress }: { label: string; icon: IconName; selected: boolean; onPress: () => void }) {
  const press = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(check, { toValue: selected ? 1 : 0, damping: 9, stiffness: 260, useNativeDriver: nativeDriver }).start();
  }, [selected, check]);
  const border = selected ? '#5cb84d' : colors.border2;
  const face = selected ? (colors.scheme === 'dark' ? '#1f3a1b' : '#effce9') : colors.scheme === 'dark' ? '#1d2127' : '#ffffff';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPressIn={() => Animated.timing(press, { toValue: 1, duration: 60, useNativeDriver: nativeDriver }).start()}
      onPressOut={() => Animated.timing(press, { toValue: 0, duration: 140, useNativeDriver: nativeDriver }).start()}
      onPress={onPress}
      style={{ height: 68 }}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, borderRadius: 18, backgroundColor: border }} />
      <Animated.View
        style={{
          height: 64,
          borderRadius: 18,
          borderWidth: 2,
          borderColor: border,
          backgroundColor: face,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }],
        }}
      >
        <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? '#a9f19d' : colors.surface3 }}>
          <Icon name={icon} size={19} color={selected ? '#14400d' : colors.text} />
        </View>
        <Text style={[typography.rowLabel145, { color: colors.text, flex: 1, marginLeft: 12, fontFamily: 'Inter_600SemiBold' }]}>{label}</Text>
        <Animated.View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5cb84d', opacity: check, transform: [{ scale: check }] }}>
          <Icon name="check" size={15} color="#ffffff" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function HowStep() {
  return (
    <View>
      <StatementToInsight />
      <View style={{ height: 20 }} />
      {HOW.map((h, i) => (
        <PopIn key={h.title} delay={250 + i * 220}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ alignItems: 'center', width: 44 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={h.icon} size={19} color={colors.onInk} />
              </View>
              {i < HOW.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 22, marginVertical: 4, borderRadius: 1, backgroundColor: colors.border2 }} /> : null}
            </View>
            <View style={{ flex: 1, marginLeft: 14, paddingBottom: 18 }}>
              <Text style={[typography.cardTitle, { color: colors.text, fontFamily: 'Inter_600SemiBold', marginTop: 2 }]}>{h.title}</Text>
              <Text style={[typography.body13, { color: colors.muted, marginTop: 3 }]}>{h.body}</Text>
            </View>
          </View>
        </PopIn>
      ))}
    </View>
  );
}

/** A looping illustration: a PDF page slides into a phone and turns into rising bars. */
function StatementToInsight() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: nativeDriver }),
        Animated.delay(1500),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: nativeDriver }),
        Animated.delay(250),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  const bars = [0.45, 0.7, 0.35, 0.9, 0.6];
  return (
    <View style={{ height: 130, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Animated.View
        style={{
          width: 62,
          height: 80,
          borderRadius: 8,
          backgroundColor: colors.scheme === 'dark' ? '#2a2f36' : '#ffffff',
          borderWidth: 1,
          borderColor: colors.border2,
          padding: 8,
          opacity: t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0.25] }),
          transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) }, { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) }, { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) }],
        }}
      >
        <Text style={[typography.badge10, { color: '#c0283a' }]}>PDF</Text>
        {[0.9, 0.7, 0.8, 0.5, 0.75].map((w, i) => (
          <View key={i} style={{ height: 4, width: `${w * 100}%`, borderRadius: 2, backgroundColor: colors.surface3, marginTop: 6 }} />
        ))}
      </Animated.View>
      <Icon name="arrow-right" size={20} color={colors.faint} style={{ marginHorizontal: 22 }} />
      <View style={{ width: 92, height: 80, flexDirection: 'row', alignItems: 'flex-end' }}>
        {bars.map((h, i) => (
          <Animated.View
            key={i}
            style={{
              flex: 1,
              marginHorizontal: 3,
              height: `${h * 100}%`,
              borderRadius: 5,
              backgroundColor: i === 3 ? colors.ink : colors.surface3,
              transformOrigin: 'center bottom',
              transform: [{ scaleY: t.interpolate({ inputRange: [0, 0.4 + i * 0.1, 1], outputRange: [0.05, 0.05, 1], extrapolate: 'clamp' }) }],
            }}
          />
        ))}
      </View>
    </View>
  );
}

function PromiseStep() {
  return (
    <View>
      {PROMISES.map((p, i) => (
        <PopIn key={p.text} delay={150 + i * 260} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface3 }}>
              <Icon name={p.icon} size={18} color={colors.text} />
            </View>
            <Text style={[typography.rowLabel14, { color: colors.text, flex: 1, marginLeft: 12 }]}>{p.text}</Text>
            <TickIn delay={350 + i * 260} />
          </View>
        </PopIn>
      ))}
    </View>
  );
}

/** A green tick that pops in with a little haptic, one after another down the list. */
function TickIn({ delay }: { delay: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const id = setTimeout(() => {
      haptics.select();
      Animated.spring(t, { toValue: 1, damping: 8, stiffness: 280, useNativeDriver: nativeDriver }).start();
    }, delay);
    return () => clearTimeout(id);
  }, [t, delay]);
  return (
    <Animated.View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5cb84d', transform: [{ scale: t }, { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-45deg', '0deg'] }) }] }}>
      <Icon name="check" size={14} color="#ffffff" />
    </Animated.View>
  );
}

function AlertsStep() {
  const s = useSettings();
  return (
    <View>
      <PopIn delay={60} style={{ marginBottom: 12 }}>
        <AlertCard icon="notifications-none" title="Analysis finished" body="A ping when a statement is ready to explore." value={s.notifyAnalysisFinished} onChange={s.setNotifyAnalysisFinished} />
      </PopIn>
      <PopIn delay={160}>
        <AlertCard icon="priority-high" title="Unusual spending" body="Only when a WATCH-level signal shows up." value={s.notifyUnusualSpend} onChange={s.setNotifyUnusualSpend} />
      </PopIn>
      <Text style={[typography.footnote1155, { color: colors.faint, textAlign: 'center', marginTop: 16 }]}>You can change these any time in Profile.</Text>
    </View>
  );
}

function AlertCard({ icon, title, body, value, onChange }: { icon: IconName; title: string; body: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: value ? colors.ink : colors.surface3 }}>
        <Icon name={icon} size={19} color={value ? colors.onInk : colors.text} />
      </View>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={[typography.rowLabel145, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>{title}</Text>
        <Text style={[typography.footnote1155, { color: colors.muted, marginTop: 2 }]}>{body}</Text>
      </View>
      <Toggle label={title} value={value} onChange={onChange} />
    </View>
  );
}

function DoneStep({ goals }: { goals: Goal[] }) {
  const picked = GOAL_OPTIONS.filter((g) => goals.includes(g.id));
  return (
    <View style={{ alignItems: 'center' }}>
      <PopIn delay={150}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: '#a9f19d', alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: '#d9fbd2' }}>
          <Icon name="check" size={56} color="#14400d" />
        </View>
      </PopIn>
      <Text style={[typography.bigHeadline26, { color: colors.text, marginTop: 20, textAlign: 'center' }]}>Tour complete!</Text>
      <Text style={[typography.body14, { color: colors.muted, marginTop: 6, textAlign: 'center' }]}>Create an account and add your first statement.</Text>
      {picked.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
          {picked.map((g, i) => (
            <PopIn key={g.id} delay={450 + i * 90} style={{ margin: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <Icon name={g.icon} size={14} color={colors.text} />
                <Text style={[typography.meta12, { color: colors.text, marginLeft: 6 }]}>{g.label}</Text>
              </View>
            </PopIn>
          ))}
        </View>
      ) : null}
    </View>
  );
}
