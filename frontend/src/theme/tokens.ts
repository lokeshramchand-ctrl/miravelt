/** Radius scale: 8 (chip) · 12 (field) · 18 (card) · 28 (sheet, top only) · pill. */
export const radius = { chip: 8, field: 12, card: 18, sheet: 28, pill: 100 } as const;

/** Spacing scale: 4 · 8 · 12 · 16 · 22 · 26 · 32. Screen gutter is 22. */
export const spacing = {
  xs: 4,
  sm: 8,
  smd: 12,
  md: 16,
  gutter: 22,
  lg: 26,
  xl: 32,
  /** Bottom scroll-content clearance for the tab bodies, so content doesn't render behind the floating pill nav. */
  navClearance: 108,
} as const;
