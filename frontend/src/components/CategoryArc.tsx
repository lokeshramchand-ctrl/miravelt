import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { categoryIcon, colors } from '../theme/colors';
import { motion } from '../theme/tokens';
import { typography } from '../theme/typography';
import { Icon } from './Icon';
import { nativeDriver, PressableScale } from './motion';
import { haptics } from '../lib/haptics';

export interface ArcCategory {
  category: string;
  amount: number;
}

interface CategoryArcProps {
  categories: ArcCategory[];
  total: number;
  /** Rendered inside the circle's open left side: the headline amount block. */
  children?: React.ReactNode;
  onOpen: (category: string) => void;
  onAdd?: () => void;
  height?: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const PILL_FROM = -104;
const PILL_TO = -54;
const PILL_W = 46;
const DOT = 42;

/**
 * The Overview's signature control: categories laid out on an arc. The selected one rides in a
 * thick ink pill (its glyph + share of spend, the text following the curve); the next ones sit in
 * white circles further round. Tap a circle to bring it into the pill, tap the pill to open it.
 */
export function CategoryArc({ categories, total, children, onOpen, onAdd, height = 330 }: CategoryArcProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(categories[0]?.category ?? null);
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!categories.some((c) => c.category === selected)) setSelected(categories[0]?.category ?? null);
  }, [categories, selected]);

  const choose = (category: string) => {
    haptics.select();
    setSelected(category);
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, ...motion.spring, useNativeDriver: nativeDriver }).start();
  };

  const current = categories.find((c) => c.category === selected) ?? categories[0];
  const others = categories.filter((c) => c.category !== current?.category).slice(0, 4);

  const cx = width * 0.37;
  const R = width * 0.5;
  const cy = R + 36;
  // Circles sit shoulder to shoulder round the rim: one dot + a gap of arc per step.
  const step = ((DOT + 8) / R) * (180 / Math.PI);
  const first = PILL_TO + (PILL_W / 2 + DOT / 2 + 10) / R * (180 / Math.PI);
  const DOT_ANGLES = [0, 1, 2, 3].map((i) => first + i * step);
  const ADD_ANGLE = first + 4 * step;
  const at = (deg: number, r = R) => ({ x: cx + r * Math.cos(rad(deg)), y: cy + r * Math.sin(rad(deg)) });
  const p0 = at(PILL_FROM);
  const p1 = at(PILL_TO);
  const arc = `M${p0.x},${p0.y} A${R},${R} 0 0 1 ${p1.x},${p1.y}`;
  const share = current && total > 0 ? (current.amount / total) * 100 : 0;
  const mid = at((PILL_FROM + PILL_TO) / 2 + 6);
  const midAngle = (PILL_FROM + PILL_TO) / 2 + 6 + 90;
  const iconAt = at(PILL_FROM + 3);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && current ? (
        <>
          <Svg width={width} height={height} style={{ position: 'absolute' }} pointerEvents="none">
            <Path d={arc} stroke={colors.ink} strokeWidth={PILL_W} strokeLinecap="round" fill="none" />
          </Svg>

          {/* category name, to the left of where the pill starts */}
          <Text numberOfLines={1} style={[typography.body13, { position: 'absolute', right: width - p0.x + PILL_W / 2 + 10, top: p0.y - 9, color: colors.muted, maxWidth: p0.x }]}>
            {current.category}
          </Text>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${current.category}, ${share.toFixed(1)} percent of spending. Open`}
            onPress={() => onOpen(current.category)}
            haptic="tap"
            scaleTo={0.96}
            style={{ position: 'absolute', left: Math.min(p0.x, p1.x) - PILL_W / 2, top: p0.y - PILL_W / 2, width: Math.abs(p1.x - p0.x) + PILL_W, height: p1.y - p0.y + PILL_W }}
          >
            <Animated.View style={{ position: 'absolute', left: iconAt.x - (Math.min(p0.x, p1.x) - PILL_W / 2) - 9, top: iconAt.y - (p0.y - PILL_W / 2) - 9, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) }] }}>
              <Icon name={categoryIcon(current.category)} size={18} color={colors.onInk} />
            </Animated.View>
            <Animated.Text
              style={[
                typography.body14,
                {
                  position: 'absolute',
                  width: 80,
                  textAlign: 'center',
                  left: mid.x - (Math.min(p0.x, p1.x) - PILL_W / 2) - 40,
                  top: mid.y - (p0.y - PILL_W / 2) - 10,
                  color: colors.onInk,
                  opacity: pop,
                  transform: [{ rotate: `${midAngle}deg` }, { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                },
              ]}
            >
              {`${share.toFixed(1)}%`}
            </Animated.Text>
          </PressableScale>

          {others.map((c, i) => {
            const p = at(DOT_ANGLES[i]);
            return <ArcDot key={c.category} x={p.x} y={p.y} index={i} label={c.category} onPress={() => choose(c.category)} icon={categoryIcon(c.category)} />;
          })}
          {onAdd ? (() => {
            const p = at(ADD_ANGLE);
            return <ArcDot x={p.x} y={p.y} index={others.length} label="Add a statement" onPress={onAdd} icon="plus" />;
          })() : null}

          <View style={{ position: 'absolute', left: 0, top: cy - R * 0.36, width: cx + R * 0.66 }}>{children}</View>
        </>
      ) : null}
    </View>
  );
}

function ArcDot({ x, y, index, label, onPress, icon }: { x: number; y: number; index: number; label: string; onPress: () => void; icon: Parameters<typeof Icon>[0]['name'] }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: 1, delay: 120 + index * 70, ...motion.spring, useNativeDriver: nativeDriver }).start();
  }, [t, index]);
  return (
    <Animated.View style={{ position: 'absolute', left: x - DOT / 2, top: y - DOT / 2, opacity: t, transform: [{ scale: t }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}>
        {({ pressed }) => (
          <View
            style={{
              width: DOT,
              height: DOT,
              borderRadius: DOT / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.surface2 : colors.scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.78)',
              borderWidth: 1,
              borderColor: colors.border,
              transform: [{ scale: pressed ? 0.9 : 1 }],
            }}
          >
            <Icon name={icon} size={17} color={colors.text} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
