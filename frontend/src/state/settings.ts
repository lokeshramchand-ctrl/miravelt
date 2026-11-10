import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { parseApiEnvironment, resolveBaseUrl } from '../config/apiEnvironment';
import type { ApiEnvironment } from '../config/apiEnvironment';

export type ThemeMode = 'system' | 'light' | 'dark';

// Same keys the Flutter client used, so the semantics line up across the port.
const KEYS = {
  themeMode: 'miravelt.theme_mode',
  keepOriginalPdfs: 'miravelt.keep_original_pdfs',
  notifyAnalysisFinished: 'miravelt.notify_analysis_finished',
  notifyUnusualSpend: 'miravelt.notify_unusual_spend',
  apiEnvironment: 'miravelt.api_environment',
  customApiBaseUrl: 'miravelt.custom_api_base_url',
  developerModeUnlocked: 'miravelt.developer_mode_unlocked',
} as const;

export interface SettingsState {
  /** False until the stored values have been read - the root layout holds the splash until then. */
  hydrated: boolean;
  themeMode: ThemeMode;
  /** On-device preferences with no server-side counterpart (yet). Real and persisted, not wired to backend behavior. */
  keepOriginalPdfs: boolean;
  notifyAnalysisFinished: boolean;
  notifyUnusualSpend: boolean;
  /**
   * Which backend the app talks to. Persisted so a developer's choice survives
   * restarts; always starts from production on a fresh install/unrecognized
   * value - never silently defaults to a developer's local machine.
   */
  apiEnvironment: ApiEnvironment;
  /** The developer-entered URL backing `custom`; kept around so re-selecting Custom prefills the last value. */
  customApiBaseUrl: string;
  /** Unlocked by tapping the "Developer settings" row 5 times; persisted once found. */
  developerModeUnlocked: boolean;

  hydrate(): Promise<void>;
  setThemeMode(mode: ThemeMode): void;
  setKeepOriginalPdfs(value: boolean): void;
  setNotifyAnalysisFinished(value: boolean): void;
  setNotifyUnusualSpend(value: boolean): void;
  setApiEnvironment(environment: ApiEnvironment): void;
  setCustomApiBaseUrl(url: string): void;
  setDeveloperModeUnlocked(value: boolean): void;
}

function persist(key: string, value: string): void {
  AsyncStorage.setItem(key, value).catch(() => {
    // Best-effort: the in-memory value still applies for this session.
  });
}

export const useSettings = create<SettingsState>((set) => ({
  hydrated: false,
  themeMode: 'system',
  keepOriginalPdfs: true,
  notifyAnalysisFinished: true,
  notifyUnusualSpend: false,
  apiEnvironment: 'production',
  customApiBaseUrl: '',
  developerModeUnlocked: false,

  async hydrate() {
    try {
      const entries = await AsyncStorage.multiGet(Object.values(KEYS));
      const stored = Object.fromEntries(entries) as Record<string, string | null>;
      const bool = (key: string, fallback: boolean) => (stored[key] == null ? fallback : stored[key] === 'true');
      const theme = stored[KEYS.themeMode];
      set({
        themeMode: theme === 'light' || theme === 'dark' ? theme : 'system',
        keepOriginalPdfs: bool(KEYS.keepOriginalPdfs, true),
        notifyAnalysisFinished: bool(KEYS.notifyAnalysisFinished, true),
        notifyUnusualSpend: bool(KEYS.notifyUnusualSpend, false),
        apiEnvironment: parseApiEnvironment(stored[KEYS.apiEnvironment]),
        customApiBaseUrl: stored[KEYS.customApiBaseUrl] ?? '',
        developerModeUnlocked: bool(KEYS.developerModeUnlocked, false),
      });
    } finally {
      set({ hydrated: true });
    }
  },

  setThemeMode(mode) {
    set({ themeMode: mode });
    persist(KEYS.themeMode, mode);
  },
  setKeepOriginalPdfs(value) {
    set({ keepOriginalPdfs: value });
    persist(KEYS.keepOriginalPdfs, String(value));
  },
  setNotifyAnalysisFinished(value) {
    set({ notifyAnalysisFinished: value });
    persist(KEYS.notifyAnalysisFinished, String(value));
  },
  setNotifyUnusualSpend(value) {
    set({ notifyUnusualSpend: value });
    persist(KEYS.notifyUnusualSpend, String(value));
  },
  setApiEnvironment(environment) {
    set({ apiEnvironment: environment });
    persist(KEYS.apiEnvironment, environment);
  },
  setCustomApiBaseUrl(url) {
    set({ customApiBaseUrl: url });
    persist(KEYS.customApiBaseUrl, url);
  },
  setDeveloperModeUnlocked(value) {
    set({ developerModeUnlocked: value });
    persist(KEYS.developerModeUnlocked, String(value));
  },
}));

/** The base URL every request actually targets (custom resolved against its stored URL). */
export function effectiveApiBaseUrl(state: Pick<SettingsState, 'apiEnvironment' | 'customApiBaseUrl'> = useSettings.getState()): string {
  return resolveBaseUrl(state.apiEnvironment, state.customApiBaseUrl);
}
