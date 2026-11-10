import { useColorScheme } from 'react-native';
import { useSettings } from '../state/settings';
import { colors } from './colors';

/**
 * The app's light/dark resolution. Screens still choose their own surface
 * (ink vs paper) explicitly, as the mockups do; this only decides the
 * *default* surface (scaffold background, status bar, text) from the stored
 * theme mode, falling back to the OS setting for "system".
 */
export function useTheme() {
  const mode = useSettings((s) => s.themeMode);
  const system = useColorScheme();
  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  return {
    isDark,
    background: isDark ? colors.ink900 : colors.paper,
    surface: isDark ? colors.ink850 : colors.card,
    onSurface: isDark ? colors.onDark : colors.onLight,
    onSurfaceMuted: isDark ? colors.onDarkMuted : colors.onLightMuted,
    onSurfaceFaint: isDark ? colors.onDarkFaint : colors.onLightFaint,
    hairline: isDark ? colors.hairlineDark : colors.hairlineLight,
  };
}
