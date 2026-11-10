import type { TextStyle } from 'react-native';

/**
 * Text styles for the design's font system: Space Grotesk (amounts/headlines)
 * and Instrument Sans (body, labels, meta). Colors are applied at the call
 * site since the same role is reused on both dark and light surfaces.
 *
 * Global `font-variant-numeric: tabular-nums` (per the design tokens) keeps
 * digits fixed-width, which amounts need to align in lists and columns.
 */
const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

export const typography = {
  heroAmount44: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 44, lineHeight: 44, letterSpacing: -1.32, fontVariant: TABULAR },
  heroAmount40: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 40, lineHeight: 40, letterSpacing: -1.2, fontVariant: TABULAR },
  heroAmount36: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 36, lineHeight: 36, letterSpacing: -0.72, fontVariant: TABULAR },
  heroAmount34: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 34, lineHeight: 34, letterSpacing: -0.68, fontVariant: TABULAR },
  screenTitle24: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, letterSpacing: -0.48, fontVariant: TABULAR },
  navTitle15: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, fontVariant: TABULAR },
  bigHeadline32: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, lineHeight: 38.4, letterSpacing: -0.96, fontVariant: TABULAR },
  bigHeadline26: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, lineHeight: 32.5, letterSpacing: -0.52, fontVariant: TABULAR },
  bigHeadline22: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, lineHeight: 28.6, letterSpacing: -0.44, fontVariant: TABULAR },
  amountMedium20: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 20, fontVariant: TABULAR },
  amountMedium19: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 19, fontVariant: TABULAR },
  amountMedium17: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 17, fontVariant: TABULAR },
  amountMedium16: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, fontVariant: TABULAR },
  amountMedium15: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, fontVariant: TABULAR },
  amountMedium14: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, fontVariant: TABULAR },
  amountSmall22: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, fontVariant: TABULAR },
  wordmark14: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, fontVariant: TABULAR },
  signalBody17: { fontFamily: 'InstrumentSans_500Medium', fontSize: 17, lineHeight: 24.65, fontVariant: TABULAR },
  cardBody15: { fontFamily: 'InstrumentSans_500Medium', fontSize: 15, lineHeight: 21.75, fontVariant: TABULAR },
  cardBody135: { fontFamily: 'InstrumentSans_500Medium', fontSize: 13.5, lineHeight: 20.25, fontVariant: TABULAR },
  body14: { fontFamily: 'InstrumentSans_500Medium', fontSize: 14, fontVariant: TABULAR },
  body13: { fontFamily: 'InstrumentSans_500Medium', fontSize: 13, lineHeight: 19.5, fontVariant: TABULAR },
  rowLabel145: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 14.5, fontVariant: TABULAR },
  rowLabel14: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 14, fontVariant: TABULAR },
  buttonLabel15: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 15, fontVariant: TABULAR },
  buttonLabel14: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 14, fontVariant: TABULAR },
  buttonLabel12: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 12, fontVariant: TABULAR },
  buttonLabel13: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 13, fontVariant: TABULAR },
  footnote1155: { fontFamily: 'InstrumentSans_400Regular', fontSize: 11.5, lineHeight: 17.25, fontVariant: TABULAR },
  footnote12: { fontFamily: 'InstrumentSans_400Regular', fontSize: 12, lineHeight: 17.4, fontVariant: TABULAR },
  footnote15: { fontFamily: 'InstrumentSans_400Regular', fontSize: 15, lineHeight: 23.25, fontVariant: TABULAR },
  microLabel11: { fontFamily: 'InstrumentSans_500Medium', fontSize: 11, letterSpacing: 1.1, fontVariant: TABULAR },
  microLabelTracked105: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 10.5, letterSpacing: 1.05, fontVariant: TABULAR },
  microLabelTracked11: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 11, letterSpacing: 1.32, fontVariant: TABULAR },
  meta115: { fontFamily: 'InstrumentSans_500Medium', fontSize: 11.5, fontVariant: TABULAR },
  meta12: { fontFamily: 'InstrumentSans_500Medium', fontSize: 12, fontVariant: TABULAR },
  metaBold12: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 12, fontVariant: TABULAR },
  badge95: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 9.5, fontVariant: TABULAR },
  badge10: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 10, fontVariant: TABULAR },
} satisfies Record<string, TextStyle>;

export type TypographyName = keyof typeof typography;
