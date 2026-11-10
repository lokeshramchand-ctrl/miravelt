import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { haptics } from '../lib/haptics';
import { colors, hues } from '../theme/colors';
import { motion } from '../theme/tokens';
import { typography } from '../theme/typography';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { easeOutSoft, nativeDriver } from './motion';

/* Micro-interactions and the playful onboarding kit: count-up numbers, a spring toggle,
   shake-on-error, confetti, chunky 3D buttons, the mascot with a typing speech bubble, and the
   thick progress bar. */

// ---------------------------------------------------------------------------
// AnimatedNumber: counts from its previous value to the new one.

export function AnimatedNumber({ value, format, style, duration = 900, numberOfLines }: { value: number; format: (n: number) => string; style?: StyleProp<TextStyle>; duration?: number; numberOfLines?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      const v = start + (value - start) * eased;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <Text numberOfLines={numberOfLines} adjustsFontSizeToFit={numberOfLines != null} accessibilityLabel={format(value)} style={style}>
      {format(Math.round(shown))}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Toggle: a switch whose knob springs across and stretches while held.

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const t = useRef(new Animated.Value(value ? 1 : 0)).current;
  const squish = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: value ? 1 : 0, ...motion.spring, useNativeDriver: false }).start();
  }, [value, t]);
  const W = 48;
  const K = 24;
  const pad = 3;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPressIn={() => Animated.spring(squish, { toValue: 1, ...motion.spring, useNativeDriver: false }).start()}
      onPressOut={() => Animated.spring(squish, { toValue: 0, ...motion.spring, useNativeDriver: false }).start()}
      onPress={() => {
        haptics.toggle();
        onChange(!value);
      }}
    >
      <Animated.View
        style={{
          width: W,
          height: K + pad * 2,
          borderRadius: 99,
          padding: pad,
          backgroundColor: t.interpolate({ inputRange: [0, 1], outputRange: [colors.surface3, colors.ink] }),
          borderWidth: 1,
          borderColor: colors.border2,
        }}
      >
        <Animated.View
          style={{
            height: K - 2,
            width: squish.interpolate({ inputRange: [0, 1], outputRange: [K - 2, K + 4] }),
            borderRadius: 99,
            backgroundColor: '#ffffff',
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            transform: [{ translateX: Animated.add(t.interpolate({ inputRange: [0, 1], outputRange: [0, W - K - pad * 2] }), Animated.multiply(squish, t.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }))) }],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// useShake: a quick horizontal shake for "that's not right" (form errors).

export function useShake() {
  const x = useRef(new Animated.Value(0)).current;
  const shake = () => {
    haptics.error();
    x.setValue(0);
    Animated.sequence(
      [10, -9, 7, -5, 3, 0].map((v) => Animated.timing(x, { toValue: v, duration: 55, easing: Easing.linear, useNativeDriver: nativeDriver })),
    ).start();
  };
  return { shake, style: { transform: [{ translateX: x }] } };
}

// ---------------------------------------------------------------------------
// Confetti: a burst of paper bits that tumble down the screen. Re-fires when `fire` changes.

const CONFETTI_COLORS = [hues.green, hues.blue, hues.orange, hues.violet, hues.amber, hues.rose, '#1b1c1f', '#a9f19d'];

function Piece({ seed, delay }: { seed: number; delay: number }) {
  const { width, height } = Dimensions.get('window');
  const r = (n: number) => {
    const x = Math.sin(seed * 9301 + n * 49297) * 233280;
    return x - Math.floor(x);
  };
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(t, { toValue: 1, duration: 2600 + r(1) * 1600, delay, easing: Easing.bezier(0.2, 0.6, 0.4, 1), useNativeDriver: nativeDriver });
    a.start();
    return () => a.stop();
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps
  const startX = width * (0.25 + r(2) * 0.5);
  const dx = (r(3) - 0.5) * width * 1.1;
  const peak = -height * (0.18 + r(4) * 0.22);
  const w = 6 + r(5) * 6;
  const h = r(6) > 0.5 ? w : w * 1.8;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: height * 0.3,
        width: w,
        height: h,
        borderRadius: r(7) > 0.7 ? w : 2,
        backgroundColor: CONFETTI_COLORS[Math.floor(r(8) * CONFETTI_COLORS.length)],
        opacity: t.interpolate({ inputRange: [0, 0.05, 0.8, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          { translateY: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, peak, height * 0.8] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(r(9) - 0.5) * 1440}deg`] }) },
          { scaleX: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.2, 1, 0.2, 1] }) },
        ],
      }}
    />
  );
}

export function Confetti({ fire, count = 70 }: { fire: number; count?: number }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  if (!fire) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((i) => (
        <Piece key={`${fire}-${i}`} seed={fire * 1000 + i} delay={(i % 10) * 25} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Button3D: the chunky onboarding button. A coloured face sits on a darker lip; pressing pushes
// the face down onto the lip.

type Variant = 'go' | 'ink' | 'ghost';
const VARIANTS: Record<Variant, () => { face: string; lip: string; fg: string; border: string }> = {
  go: () => ({ face: '#a9f19d', lip: '#6fcf5f', fg: '#14400d', border: '#8fe383' }),
  ink: () => ({ face: colors.ink, lip: colors.scheme === 'dark' ? '#b9bdc2' : '#000000', fg: colors.onInk, border: colors.ink }),
  ghost: () => ({ face: colors.scheme === 'dark' ? '#23272d' : '#ffffff', lip: colors.border2, fg: colors.text, border: colors.border2 }),
};

export function Button3D({ label, onPress, variant = 'go', disabled = false, icon, style }: { label: string; onPress?: () => void; variant?: Variant; disabled?: boolean; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const press = useRef(new Animated.Value(0)).current;
  const LIP = 5;
  const v = disabled ? { face: colors.surface3, lip: colors.border2, fg: colors.faint, border: 'transparent' } : VARIANTS[variant]();
  const to = (n: number) => Animated.timing(press, { toValue: n, duration: n ? 60 : 140, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={[{ alignSelf: 'stretch', height: 56 + LIP }, style]}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, borderRadius: 18, backgroundColor: v.lip }} />
      <Animated.View
        style={{
          height: 56,
          borderRadius: 18,
          backgroundColor: v.face,
          borderWidth: 1.5,
          borderColor: v.border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, LIP] }) }],
        }}
      >
        {icon ? <Icon name={icon} size={18} color={v.fg} style={{ marginRight: 8 }} /> : null}
        <Text style={[typography.buttonLabel15, { color: v.fg, fontFamily: 'Inter_700Bold', fontSize: 15.5, letterSpacing: 0.4, textTransform: 'uppercase' }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// The mascot: Miro the octopus. Bobs gently, hops when tapped, and talks through a bubble
// whose text types itself out.

const MIRO = require('../../assets/avatars/baby-octopus.png');

export function Mascot({ size = 96, hop = 0, onPress }: { size?: number; hop?: number; onPress?: () => void }) {
  const bob = useRef(new Animated.Value(0)).current;
  const jump = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const doHop = () => {
    jump.setValue(0);
    Animated.sequence([
      Animated.timing(jump, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
      Animated.spring(jump, { toValue: 0, damping: 6, stiffness: 260, mass: 0.7, useNativeDriver: nativeDriver }),
    ]).start();
  };
  useEffect(() => {
    if (hop) doHop();
  }, [hop]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel="Miro, the Miravelt octopus"
      onPress={() => {
        haptics.tap();
        doHop();
        onPress?.();
      }}
    >
      <Animated.View
        style={{
          transform: [
            { translateY: Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }), jump.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.28] })) },
            { scaleX: jump.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.94, 1.04] }) },
            { scaleY: jump.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.07, 0.97] }) },
            { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] }) },
          ],
        }}
      >
        <View style={{ width: size, height: size, borderRadius: size * 0.34, overflow: 'hidden', borderWidth: 3, borderColor: '#ffffff', backgroundColor: '#a6d8ff' }}>
          <Image source={MIRO} style={{ width: size - 6, height: size - 6 }} resizeMode="cover" />
        </View>
      </Animated.View>
      <Animated.View
        style={{
          alignSelf: 'center',
          width: size * 0.6,
          height: 8,
          marginTop: 6,
          borderRadius: 99,
          backgroundColor: 'rgba(40, 50, 65, 0.16)',
          transform: [{ scaleX: Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }), jump.interpolate({ inputRange: [0, 1], outputRange: [0, -0.4] })) }],
        }}
      />
    </Pressable>
  );
}

/** A speech bubble whose text types itself out; re-types whenever `text` changes. */
export function SpeechBubble({ text, tail = 'left', style }: { text: string; tail?: 'left' | 'bottom'; style?: StyleProp<ViewStyle> }) {
  const [n, setN] = useState(0);
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setN(0);
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, ...motion.spring, useNativeDriver: nativeDriver }).start();
    const id = setInterval(() => setN((c) => (c >= text.length ? (clearInterval(id), c) : c + 1)), 18);
    return () => clearInterval(id);
  }, [text, pop]);
  const bg = colors.scheme === 'dark' ? '#23272d' : '#ffffff';
  return (
    <Animated.View style={[{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }, style]}>
      <View style={{ backgroundColor: bg, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border2, paddingHorizontal: 15, paddingVertical: 12 }}>
        {/* The full text reserves the bubble's size so it doesn't grow while typing. */}
        <Text style={[typography.cardBody15, { color: 'transparent' }]}>{text}</Text>
        <Text accessibilityLabel={text} style={[typography.cardBody15, { color: colors.text, position: 'absolute', left: 15, right: 15, top: 12 }]}>
          {text.slice(0, n)}
        </Text>
      </View>
      {tail === 'left' ? (
        <View style={{ position: 'absolute', left: -7, top: 18, width: 14, height: 14, backgroundColor: bg, borderLeftWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.border2, transform: [{ rotate: '45deg' }] }} />
      ) : (
        <View style={{ position: 'absolute', bottom: -7, alignSelf: 'center', width: 14, height: 14, backgroundColor: bg, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.border2, transform: [{ rotate: '45deg' }] }} />
      )}
    </Animated.View>
  );
}

/** The thick, rounded onboarding progress bar with a highlight stripe; springs to each new value. */
export function ChunkyProgress({ value }: { value: number }) {
  const w = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.spring(w, { toValue: value, ...motion.springSoft, useNativeDriver: false }).start();
  }, [value, w]);
  const width = w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }} style={{ flex: 1, height: 16, borderRadius: 99, backgroundColor: colors.surface3, overflow: 'hidden' }}>
      <Animated.View style={{ width, height: '100%', borderRadius: 99, backgroundColor: '#7fdc6e', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 8, right: 8, top: 3, height: 4, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.45)' }} />
      </Animated.View>
    </View>
  );
}

/** Slides its children in from the side when `stepKey` changes (direction follows `dir`). */
export function StepTransition({ stepKey, dir, children }: { stepKey: string | number; dir: 1 | -1; children: React.ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 380, easing: easeOutSoft, useNativeDriver: nativeDriver }).start();
  }, [stepKey, t]);
  return (
    <Animated.View style={{ flex: 1, opacity: t, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [36 * dir, 0] }) }] }}>{children}</Animated.View>
  );
}

/** Pops in after `delay` with an overshoot - used for list items that arrive one by one. */
export function PopIn({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.spring(t, { toValue: 1, delay, damping: 11, stiffness: 200, mass: 0.8, useNativeDriver: nativeDriver });
    a.start();
    return () => a.stop();
  }, [t, delay]);
  return <Animated.View style={[style, { opacity: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }), transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>{children}</Animated.View>;
}
