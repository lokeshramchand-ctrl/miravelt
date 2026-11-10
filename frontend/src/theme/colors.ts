/**
 * Colour tokens. The skin follows bencho.dev, the same one the SPL Console web dashboard
 * uses: warm paper neutrals, a near-black ink, one ultramarine "signal" accent, hairline
 * borders, and status colours used only for meaning.
 *
 * `colors` is one object whose values are swapped in place by `applyColorScheme` when the
 * theme changes (Profile > Theme). Read tokens at render time (`colors.text` inside a
 * component, or inside `StyleSheet.create` only for non-colour values) so a theme switch
 * repaints them.
 */
const light = {
  /** Flat fallback for the backdrop gradient (see `backdrop`). */
  bg: '#e6e9ec',
  /** Frosted glass: translucent white over the gradient, with a brighter hairline edge. */
  surface: 'rgba(255, 255, 255, 0.58)',
  surface2: 'rgba(255, 255, 255, 0.42)',
  surface3: 'rgba(23, 26, 31, 0.07)',
  border: 'rgba(255, 255, 255, 0.75)',
  border2: 'rgba(23, 26, 31, 0.14)',
  /** Opaque surface for things that float over content (sheets, dialogs, toasts). */
  solid: '#f3f5f7',
  text: '#16181b',
  muted: '#676d75',
  faint: '#959ba3',
  /** Solid "ink" fills: the black pill accents, primary buttons, the selected tab. */
  ink: '#1b1c1f',
  onInk: '#ffffff',
  signal: '#1b1c1f',
  signalSoft: 'rgba(27, 28, 31, 0.07)',
  signalText: '#1b1c1f',
  /** Status text straight on glass. */
  up: '#23801a',
  warn: '#9a5c00',
  down: '#c0283a',
  /** Pastel badge fills with their dark ink (same ink in both themes - the badges stay bright). */
  upSoft: '#a9f19d',
  warnSoft: '#ffd98a',
  downSoft: '#ffb1ba',
  upInk: '#14400d',
  warnInk: '#5a3500',
  downInk: '#6e0f1b',
  scrim: 'rgba(30, 36, 44, 0.28)',
  shadow: '#5d6b7a',
};

type Palette = typeof light;

const dark: Palette = {
  bg: '#14171b',
  surface: 'rgba(255, 255, 255, 0.07)',
  surface2: 'rgba(255, 255, 255, 0.05)',
  surface3: 'rgba(255, 255, 255, 0.10)',
  border: 'rgba(255, 255, 255, 0.10)',
  border2: 'rgba(255, 255, 255, 0.18)',
  solid: '#1d2127',
  text: '#f1f3f5',
  muted: '#9aa1a9',
  faint: '#6f767e',
  ink: '#f1f3f5',
  onInk: '#121417',
  signal: '#f1f3f5',
  signalSoft: 'rgba(255, 255, 255, 0.09)',
  signalText: '#f1f3f5',
  up: '#8fe383',
  warn: '#f5c860',
  down: '#ff8f9d',
  upSoft: '#8fe383',
  warnSoft: '#f5c860',
  downSoft: '#ff9aa6',
  upInk: '#14400d',
  warnInk: '#4a2c00',
  downInk: '#5c0e16',
  scrim: 'rgba(0, 0, 0, 0.55)',
  shadow: '#000000',
};

/** The screen backdrop: a soft cool-gray wash that turns pale blue toward the bottom. */
export const backdrop = {
  light: ['#f0f1f2', '#e4e7ea', '#cdd9e4'] as const,
  dark: ['#121417', '#161a1f', '#1b2430'] as const,
};

/** Fixed tokens for the dark accent shapes (the arc pill) - the same in both themes. */
const hero = {
  heroBg: '#1b1c1f',
  heroSurface: 'rgba(255, 255, 255, 0.08)',
  heroBorder: 'rgba(255, 255, 255, 0.12)',
  heroText: '#ffffff',
  heroMuted: 'rgba(255, 255, 255, 0.66)',
  heroFaint: 'rgba(255, 255, 255, 0.42)',
  heroSignal: '#ffffff',
  heroUp: '#a9f19d',
  heroDown: '#ffb1ba',
} as const;

/** Category hues - the chart palette. Same in both themes; each reads on paper and on ink. */
export const hues = {
  orange: '#f08a5d',
  violet: '#8f7ee7',
  amber: '#e6b04a',
  blue: '#5b8def',
  teal: '#3bb8a6',
  rose: '#ec6a7a',
  green: '#5cc16a',
} as const;

export type ColorScheme = 'light' | 'dark';

export const colors: Palette & typeof hero & { scheme: ColorScheme } = { ...light, ...hero, scheme: 'light' };

/** Swap every theme-dependent token in place. Returns true when something changed. */
export function applyColorScheme(scheme: ColorScheme): boolean {
  if (colors.scheme === scheme) return false;
  Object.assign(colors, scheme === 'dark' ? dark : light, { scheme });
  return true;
}

/** `rgba(...)`/`#rrggbb` with a new alpha. */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return color.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/, `rgba($1, $2, $3, ${alpha})`);
}

/**
 * Category name -> chart hue. The backend's full taxonomy has more categories than the
 * design illustrates, so every real category gets an explicit, non-alarming hue - rose is
 * reserved for truly unrecognized/uncategorized spend.
 */
export function categoryColor(category: string): string {
  switch (category.toLowerCase()) {
    case 'food':
    case 'friends':
      return hues.orange;
    case 'travel':
    case 'personal care':
    case 'education':
      return hues.violet;
    case 'bills':
    case 'healthcare':
    case 'utility':
      return hues.amber;
    case 'shopping':
    case 'entertainment':
    case 'subscription':
      return hues.blue;
    case 'income':
      return hues.green;
    default:
      return hues.rose;
  }
}

/** Category name -> its glyph (Phosphor fill), shown in the Overview arc and category chips. */
export function categoryIcon(category: string): import('../components/iconPaths').IconName {
  switch (category.toLowerCase()) {
    case 'food':
      return 'cat-food';
    case 'travel':
      return 'cat-travel';
    case 'bills':
      return 'cat-bills';
    case 'utility':
      return 'cat-utility';
    case 'shopping':
      return 'cat-shopping';
    case 'personal care':
      return 'cat-care';
    case 'entertainment':
      return 'cat-fun';
    case 'subscription':
      return 'cat-subscription';
    case 'healthcare':
      return 'cat-health';
    case 'friends':
      return 'cat-friends';
    case 'education':
      return 'cat-education';
    case 'income':
      return 'cat-income';
    default:
      return 'cat-other';
  }
}
