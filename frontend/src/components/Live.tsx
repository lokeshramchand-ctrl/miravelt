import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { formatElapsed, revealChunks } from '../lib/format';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { nativeDriver } from './motion';

/* Live states for slow, async work - the patterns from beautifului.dev's agent kit (loading
   state with elapsed time, thinking indicator, streaming text, task rows), rebuilt on Animated.
   Everything here goes static when the OS "reduce motion" setting is on. */

// ---------------------------------------------------------------------------
// useReducedMotion: the OS accessibility setting, live.

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => live && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      sub?.remove();
    };
  }, []);
  return reduced;
}

// ---------------------------------------------------------------------------
// useElapsed: milliseconds since `since`, re-rendering once a second while `running`.

export function useElapsed(since: number | null, running = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since == null || !running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since, running]);
  return since == null ? 0 : now - since;
}

// ---------------------------------------------------------------------------
// DotWave: three dots rising one after another - "working on it".

export function DotWave({ color = colors.muted, size = 5 }: { color?: string; size?: number }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: nativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [t, reduced]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: size * 3 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((i) => {
        const a = 0.12 * i;
        const range = { inputRange: [0, a + 0.001, a + 0.15, a + 0.3, 1], extrapolate: 'clamp' as const };
        return (
          <Animated.View
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: i === 0 ? 0 : size * 0.6,
              backgroundColor: color,
              opacity: reduced ? 0.7 : t.interpolate({ ...range, outputRange: [0.35, 0.35, 1, 0.35, 0.35] }),
              transform: reduced ? [] : [{ translateY: t.interpolate({ ...range, outputRange: [0, 0, -size * 0.9, 0, 0] }) }],
            }}
          />
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ThinkingIndicator: dot wave + a softly breathing label + elapsed time.

export function ThinkingIndicator({ label, since, color = colors.signalText }: { label: string; since: number | null; color?: string }) {
  const reduced = useReducedMotion();
  const elapsed = useElapsed(since);
  const breathe = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 0.5, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: nativeDriver }),
        Animated.timing(breathe, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reduced]);
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <DotWave color={color} />
      <Animated.Text style={[typography.buttonLabel12, { color, marginLeft: 10, opacity: breathe }]}>{label}</Animated.Text>
      <Text style={[typography.microLabel11, { color: colors.faint, marginLeft: 8 }]}>{formatElapsed(elapsed)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// StreamedText: reveals already-received text word by word with a caret, like a streamed
// answer. Presentation only - the full text is there from the start: an invisible copy
// reserves the final height (so the sheet doesn't jump) and screen readers get all of it.

export function StreamedText({ text, style, caretColor = colors.signalText, wordMs = 28, maxMs = 1400 }: { text: string; style?: StyleProp<TextStyle>; caretColor?: string; wordMs?: number; maxMs?: number }) {
  const reduced = useReducedMotion();
  const chunks = useRef<string[]>([]);
  const [count, setCount] = useState(0);
  useEffect(() => {
    chunks.current = revealChunks(text);
    setCount(0);
    const total = chunks.current.length;
    if (total === 0) return;
    const step = Math.max(8, Math.min(wordMs, maxMs / total));
    const id = setInterval(() => {
      setCount((c) => {
        if (c + 1 >= total) clearInterval(id);
        return Math.min(total, c + 1);
      });
    }, step);
    return () => clearInterval(id);
  }, [text, wordMs, maxMs]);

  const done = reduced || count >= chunks.current.length;
  const shown = done ? text : chunks.current.slice(0, count).join('');
  return (
    <View accessible accessibilityLabel={text}>
      <Text style={[style, { color: 'transparent' }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {text}
      </Text>
      <Text style={[style, { position: 'absolute', top: 0, left: 0, right: 0 }]}>
        {shown}
        {done ? null : <Text style={{ color: caretColor }}>▍</Text>}
      </Text>
    </View>
  );
}
