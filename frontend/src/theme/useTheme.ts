import { useColorScheme } from 'react-native';
import { useSettings } from '../state/settings';
import type { ColorScheme } from './colors';

/** The theme the stored mode resolves to, falling back to the OS setting for "system". */
export function useColorSchemeSetting(): ColorScheme {
  const mode = useSettings((s) => s.themeMode);
  const system = useColorScheme();
  return (mode === 'system' ? system === 'dark' : mode === 'dark') ? 'dark' : 'light';
}
