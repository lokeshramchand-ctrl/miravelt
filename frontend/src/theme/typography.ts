import type { TextStyle } from 'react-native';

/**
 * Text styles. One family, Inter, kept light: 300 for big amounts, 400 for titles and body,
 * 500 for labels. Small eyebrows are sentence case, not tracked caps. Every style uses
 * tabular figures so amounts don't jitter or misalign in columns.
 *
 * Style names are kept from the original design (they carry their size) so screens did not
 * have to change; colours are applied at the call site.
 */
const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];
const L = 'Inter_300Light';
const R = 'Inter_400Regular';
const M = 'Inter_500Medium';
const S = 'Inter_600SemiBold';
const B = 'Inter_700Bold';

/** Big numbers track at -0.04em, headings at -0.035em, body at -0.011em. */
/** Amounts are light and airy (300) with gentle negative tracking; small ones get 500 so they stay legible. */
const num = (fontSize: number, lineHeight?: number): TextStyle => ({ fontFamily: fontSize >= 19 ? L : M, fontSize, lineHeight, letterSpacing: -0.03 * fontSize, fontVariant: TABULAR });
const head = (fontSize: number, lineHeight?: number, family = R): TextStyle => ({ fontFamily: family, fontSize, lineHeight, letterSpacing: -0.025 * fontSize, fontVariant: TABULAR });
const body = (family: string, fontSize: number, lineHeight?: number): TextStyle => ({ fontFamily: family, fontSize, lineHeight, letterSpacing: -0.011 * fontSize, fontVariant: TABULAR });
const eyebrow = (fontSize: number, family = R): TextStyle => ({ fontFamily: family, fontSize: fontSize + 1, letterSpacing: -0.01 * fontSize, fontVariant: TABULAR });

export const typography = {
  heroAmount44: num(44, 48),
  heroAmount40: num(40, 44),
  heroAmount36: num(36, 40),
  heroAmount34: num(34, 38),
  screenTitle24: head(26, 32),
  navTitle15: head(16, undefined, M),
  bigHeadline32: head(32, 37),
  bigHeadline26: head(26, 31),
  bigHeadline22: head(22, 27),
  amountMedium20: num(20),
  amountMedium19: num(19),
  amountMedium17: num(17),
  amountMedium16: num(16),
  amountMedium15: num(15),
  amountMedium14: num(14),
  amountSmall22: num(22),
  wordmark14: head(15, undefined, B),
  signalBody17: body(M, 17, 25),
  cardBody15: body(M, 15, 22),
  cardBody135: body(R, 13.5, 20),
  body14: body(R, 14, 21),
  body13: body(R, 13, 19),
  rowLabel145: body(M, 14.5),
  rowLabel14: body(M, 14),
  buttonLabel15: body(M, 15),
  buttonLabel14: body(M, 14),
  buttonLabel12: body(M, 12.5),
  buttonLabel13: body(M, 13),
  footnote1155: body(R, 12, 17),
  footnote12: body(R, 12.5, 18),
  footnote15: body(R, 15, 23),
  microLabel11: eyebrow(11, M),
  microLabelTracked105: eyebrow(11),
  microLabelTracked11: eyebrow(11.5),
  meta115: body(M, 12),
  meta12: body(M, 12.5),
  metaBold12: body(S, 12),
  badge95: eyebrow(10),
  badge10: body(S, 10.5),
  /** Stat card value (bencho `.stat-value`). */
  statValue: num(30, 34),
  /** The page title ("Your latest insights"). */
  pageTitle: head(27, 33, R),
  /** Section / card title (`h3`, 15px 600). */
  cardTitle: head(16, undefined, R),
  /** Muted stat/section label (13px 500). */
  label13: body(M, 13),
} satisfies Record<string, TextStyle>;

export type TypographyName = keyof typeof typography;
