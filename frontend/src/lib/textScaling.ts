import { Text, TextInput } from 'react-native';

/**
 * Caps system font scaling at 1.25x app-wide so hero amounts can't overflow.
 * (The Flutter client also floored it at 0.85x; React Native only exposes the
 * upper bound.) React 19 ignores `defaultProps`, so the cap is injected by
 * wrapping the components' render functions.
 */
const MAX_MULTIPLIER = 1.25;

type Renderable = { render?: (props: Record<string, unknown>, ref: unknown) => unknown };

function cap(component: unknown): void {
  const target = component as Renderable;
  const original = target.render;
  if (!original) return;
  target.render = function (this: unknown, props, ref) {
    return original.call(this, { maxFontSizeMultiplier: MAX_MULTIPLIER, ...props }, ref);
  };
}

cap(Text);
cap(TextInput);
