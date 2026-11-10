import { oklch } from './oklch';

/**
 * Design tokens lifted verbatim (same OKLCH values) from the Miravelt Claude
 * Design source. Screens choose which surface (ink/dark vs paper/light) to sit
 * on explicitly, matching the mockups - this is not a single global
 * light/dark palette swap.
 */
export const colors = {
  ink900: oklch(0.17, 0.012, 265),
  ink850: oklch(0.195, 0.013, 265),
  ink800: oklch(0.22, 0.014, 265),
  ink700: oklch(0.27, 0.015, 265),
  hairlineDark: oklch(1.0, 0, 0, 0.09),
  onDark: oklch(0.97, 0.004, 265),
  onDarkMuted: oklch(0.73, 0.014, 265),
  onDarkFaint: oklch(0.56, 0.015, 265),
  paper: oklch(0.976, 0.004, 265),
  card: oklch(1.0, 0, 0),
  hairlineLight: oklch(0.92, 0.006, 265),
  onLight: oklch(0.21, 0.015, 265),
  onLightMuted: oklch(0.50, 0.015, 265),
  onLightFaint: oklch(0.66, 0.012, 265),
  accent: oklch(0.85, 0.17, 148),
  accentDim: oklch(0.62, 0.13, 150),
  accentInk: oklch(0.26, 0.07, 150),
  accentTint: oklch(0.94, 0.05, 148),
  violet: oklch(0.72, 0.13, 292),
  sky: oklch(0.76, 0.11, 238),
  amber: oklch(0.82, 0.13, 80),
  rose: oklch(0.69, 0.15, 15),
  roseFlowGradientEnd: oklch(0.72, 0.13, 30),
  amberTint: oklch(0.95, 0.04, 80),
  roseTint: oklch(0.95, 0.035, 15),
  amberInk: oklch(0.45, 0.1, 70),
  amberTextOnTint: oklch(0.38, 0.09, 70),
  violetInk: oklch(0.38, 0.1, 292),
  violetTint: oklch(0.95, 0.02, 292),
  skyInk: oklch(0.38, 0.09, 238),
  skyTint: oklch(0.95, 0.02, 238),
  roseInk: oklch(0.40, 0.12, 15),
  roseAvatarTint: oklch(0.95, 0.03, 15),
  progressTrackLight: oklch(0.93, 0.006, 265),
  skeletonBase: oklch(0.94, 0.005, 265),
  skeletonHighlight: oklch(0.96, 0.004, 265),
  skeletonBaseDark: oklch(0.24, 0.014, 265),
  skeletonHighlightDark: oklch(0.30, 0.015, 265),
  analysingGlowCenter: oklch(0.24, 0.04, 155),
  scrimHeavy: oklch(0.10, 0.01, 265, 0.72),
  scrimMedium: oklch(0.20, 0.01, 265, 0.35),
} as const;

/**
 * Category name -> brand color. The mock only illustrates Food/Travel/Bills/
 * Shopping/Personal Care/Income; the backend's full taxonomy has more, so every
 * real category gets an explicit, non-alarming hue - rose is reserved for truly
 * unrecognized/uncategorized spend, not "not in the mock".
 */
export function categoryColor(category: string): string {
  switch (category.toLowerCase()) {
    case 'food':
    case 'friends':
      return colors.accentDim;
    case 'travel':
    case 'personal care':
    case 'education':
      return colors.violet;
    case 'bills':
    case 'healthcare':
    case 'utility':
      return colors.amber;
    case 'shopping':
    case 'entertainment':
    case 'subscription':
      return colors.sky;
    case 'income':
      return colors.accent;
    default:
      return colors.rose;
  }
}
