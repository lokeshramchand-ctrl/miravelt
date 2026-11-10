/** Radius scale: 12 (chip) · 16 (field) · 26 (glass card) · 30 (sheet, top only) · pill. */
export const radius = { chip: 12, field: 16, card: 26, sheet: 30, pill: 999 } as const;

/** Spacing scale: 4 · 8 · 12 · 16 · 20 · 26 · 32. Screen gutter is 20. */
export const spacing = {
  xs: 4,
  sm: 8,
  smd: 12,
  md: 16,
  gutter: 20,
  lg: 26,
  xl: 32,
  /** Bottom scroll-content clearance for the tab bodies, so content doesn't render behind the floating pill nav. */
  navClearance: 112,
} as const;

/** bencho motion: a springy overshoot for presses/indicators, a soft ease-out for entrances. */
export const motion = {
  spring: { damping: 15, stiffness: 220, mass: 0.9 },
  springSoft: { damping: 20, stiffness: 170, mass: 1 },
} as const;
