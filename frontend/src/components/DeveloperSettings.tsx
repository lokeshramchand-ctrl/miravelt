import * as Application from 'expo-application';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { probeBackendHealth } from '../api/repositories';
import type { HealthProbeResult } from '../api/repositories';
import { tokenStorage } from '../api/tokenStorage';
import { API_ENVIRONMENTS, apiEnvironmentLabel } from '../config/apiEnvironment';
import type { ApiEnvironment } from '../config/apiEnvironment';
import { appConfig } from '../config/appConfig';
import { useAuth } from '../state/auth';
import { effectiveApiBaseUrl, useSettings } from '../state/settings';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { PromptDialog } from './Dialog';
import { MiraveltSheet } from './Sheet';
import { SecondaryPillButton } from './Buttons';
import { SegmentedControl } from './Controls';

/** Taps required to reveal Developer settings, and the window a run of taps has to land in - mirrors Android's own "tap the build number" gesture. */
export const TAPS_TO_UNLOCK = 5;
const TAP_WINDOW_MS = 2000;

/**
 * Validates and normalizes a developer-entered backend URL, or returns null if
 * it is not a usable absolute http(s) URL.
 */
export function normalizeBaseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = /^(https?):\/\/([^\s/:?#]+)(:\d+)?([/?#]\S*)?$/i.exec(trimmed);
  if (!match) return null;
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

/**
 * Wraps `children` in the unlock gesture. Once developer mode is unlocked, a
 * single tap opens the sheet instead, so the gesture only has to be performed
 * once per install.
 *
 * This sits on the login screen as well as Profile, deliberately: the moment
 * you need to repoint the app is the moment its backend is unreachable, and at
 * that moment you cannot sign in to reach Profile.
 */
export function DeveloperUnlockGesture({ children }: { children: React.ReactNode }) {
  const unlocked = useSettings((s) => s.developerModeUnlocked);
  const [taps, setTaps] = useState(0);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onPress = () => {
    if (unlocked) {
      setOpen(true);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTaps(0), TAP_WINDOW_MS);
    const next = taps + 1;
    if (next < TAPS_TO_UNLOCK) {
      setTaps(next);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setTaps(0);
    useSettings.getState().setDeveloperModeUnlocked(true);
    setOpen(true);
  };

  const remaining = TAPS_TO_UNLOCK - taps;
  return (
    <>
      <Pressable onPress={onPress} accessibilityRole="button" style={{ alignItems: 'stretch' }}>
        {children}
        {/* Only ever rendered mid-gesture, so someone who taps a footer once never learns there is anything hidden here. */}
        {taps > 0 && taps < TAPS_TO_UNLOCK ? (
          <Text style={[typography.footnote1155, { color: colors.onDarkFaint, marginTop: 4, textAlign: 'center' }]}>
            {remaining} more {remaining === 1 ? 'tap' : 'taps'}
          </Text>
        ) : null}
      </Pressable>
      <DeveloperSettingsSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function DeveloperSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const environment = useSettings((s) => s.apiEnvironment);
  const customUrl = useSettings((s) => s.customApiBaseUrl);
  const effectiveUrl = effectiveApiBaseUrl({ apiEnvironment: environment, customApiBaseUrl: customUrl });
  const [probing, setProbing] = useState(false);
  const [result, setResult] = useState<HealthProbeResult | null>(null);
  const [prompting, setPrompting] = useState(false);

  const testConnection = async () => {
    setProbing(true);
    setResult(null);
    const probe = await probeBackendHealth(effectiveApiBaseUrl());
    setProbing(false);
    setResult(probe);
  };

  /**
   * Signs out of the current backend *before* repointing the client. Leaving
   * that to the 401 path would send this session's bearer and refresh tokens to
   * the new host first - and a Custom URL can be any host at all. From the login
   * screen there is no session, so this is just a switch; from Profile the
   * redirect takes the now signed-out app back to /login.
   */
  const apply = async (next: ApiEnvironment, url?: string) => {
    if (await tokenStorage.hasSession()) await useAuth.getState().logout();
    if (url != null) useSettings.getState().setCustomApiBaseUrl(url);
    useSettings.getState().setApiEnvironment(next);
    setResult(null);
  };

  const switchEnvironment = async (next: ApiEnvironment) => {
    if (next === 'custom') {
      setPrompting(true);
      return;
    }
    if (next !== environment) await apply(next);
  };

  const onSubmitCustom = (value: string): string | null => {
    const normalized = normalizeBaseUrl(value);
    if (!normalized) return 'Enter a valid http(s) URL, e.g. http://192.168.1.5:8000/';
    setPrompting(false);
    if (!(environment === 'custom' && normalized === effectiveUrl)) void apply('custom', normalized);
    return null;
  };

  return (
    <>
      <MiraveltSheet visible={visible} onClose={onClose} dark>
        <Text style={[typography.rowLabel14, { fontSize: 17, color: colors.onDark }]}>Developer settings</Text>
        <Text style={[typography.footnote1155, { color: colors.onDarkMuted, marginTop: 6 }]}>
          Point the app at a different backend. MongoDB, Milvus and Ollama all sit behind whichever backend you pick.
        </Text>
        <Text style={[typography.microLabelTracked105, { color: colors.onDarkFaint, marginTop: 18, marginBottom: 10 }]}>API SERVER</Text>
        <SegmentedControl<ApiEnvironment> value={environment} options={API_ENVIRONMENTS.map((e) => [e, apiEnvironmentLabel[e]] as const)} onChange={switchEnvironment} />
        <View style={{ height: 16 }} />
        <UrlPanel url={effectiveUrl} onEdit={environment === 'custom' ? () => setPrompting(true) : undefined} />
        {environment === 'local' && Platform.OS === 'android' && effectiveUrl.includes('10.0.2.2') ? (
          <Text style={[typography.footnote1155, { color: colors.onDarkMuted, marginTop: 8 }]}>
            10.0.2.2 reaches this computer only from the Android emulator. On a physical phone, pick Custom and enter your computer's LAN address (e.g. http://192.168.1.5:9850/) - or connect over USB, run "adb reverse tcp:9850 tcp:9850" and use http://localhost:9850/.
          </Text>
        ) : null}
        <View style={{ height: 14 }} />
        <SecondaryPillButton label={probing ? 'Testing…' : 'Test connection'} foreground={colors.onDark} borderColor={colors.hairlineDark} onPress={probing ? undefined : testConnection} />
        {probing ? <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 10 }} /> : null}
        {result ? <HealthReport result={result} /> : null}
        <Text style={[typography.footnote1155, { color: colors.onDarkFaint, marginTop: 18 }]}>Switching backends signs you out - a session issued by one is not valid on another.</Text>
        {environment !== 'production' ? (
          <Pressable accessibilityRole="button" onPress={() => switchEnvironment('production')} style={{ alignSelf: 'center', paddingVertical: 10 }}>
            <Text style={[typography.footnote12, { color: colors.accentDim }]}>Reset to {apiEnvironmentLabel.production}</Text>
          </Pressable>
        ) : null}
        <Text style={[typography.microLabelTracked105, { color: colors.onDarkFaint, marginTop: 14, marginBottom: 10 }]}>BUILD</Text>
        <BuildInfo />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            useSettings.getState().setDeveloperModeUnlocked(false);
            onClose();
          }}
          style={{ alignSelf: 'center', paddingVertical: 12 }}
        >
          <Text style={[typography.footnote12, { color: colors.onDarkFaint }]}>Hide developer settings</Text>
        </Pressable>
      </MiraveltSheet>
      {prompting ? (
        <PromptDialog
          visible
          title="Custom backend URL"
          message="Your machine's LAN address and the port the backend is published on. Its firewall has to allow that port."
          initialValue={customUrl}
          placeholder="http://192.168.1.5:8000/"
          keyboardType="url"
          onSubmit={onSubmitCustom}
          onCancel={() => setPrompting(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Build facts a tester needs when a release build misbehaves: which build this
 * is, and whether a real API key was compiled in (a build without
 * EXPO_PUBLIC_MIRAVELT_API_KEY silently falls back to the test placeholder, the
 * same key a fresh backend .env ships with - fine locally, never in production).
 */
function BuildInfo() {
  const keyIsPlaceholder = appConfig.apiKey === appConfig.placeholderApiKey;
  return (
    <View>
      <InfoRow label="App version" value={versionLabel()} />
      <InfoRow label="Build mode" value={__DEV__ ? 'debug' : 'release'} />
      <InfoRow label="API key" value={keyIsPlaceholder ? 'default test key - set a real one before deploying' : 'set at build time'} warn={keyIsPlaceholder} />
    </View>
  );
}

/** `1.0.0 (1)` - the version name and the build number (Android's versionCode) the update check compares. */
export function versionLabel(): string {
  const version = Application.nativeApplicationVersion;
  const build = Application.nativeBuildVersion;
  return version ? `${version} (${build ?? '?'})` : '…';
}

function InfoRow({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
      <Text style={[typography.meta12, { width: 96, color: colors.onDarkFaint }]}>{label}</Text>
      <Text style={[typography.meta12, { flex: 1, color: warn ? colors.rose : colors.onDark }]}>{value}</Text>
    </View>
  );
}

function UrlPanel({ url, onEdit }: { url: string; onEdit?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.ink900, borderWidth: 1, borderColor: colors.hairlineDark, borderRadius: radius.field }}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.microLabelTracked105, { color: colors.onDarkFaint }]}>CURRENTLY USING</Text>
        <Text style={[typography.body14, { color: colors.onDark, marginTop: 4 }]}>{url}</Text>
      </View>
      {onEdit ? (
        <Pressable accessibilityRole="button" onPress={onEdit} hitSlop={8}>
          <Text style={[typography.buttonLabel12, { color: colors.accent }]}>Edit</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function HealthReport({ result }: { result: HealthProbeResult }) {
  const accent = result.reachable ? colors.accent : colors.rose;
  return (
    <View style={{ marginTop: 14, padding: 14, backgroundColor: colors.ink900, borderWidth: 1, borderColor: accent.replace(/[\d.]+\)$/, '0.4)'), borderRadius: radius.field }}>
      <Text style={[typography.rowLabel14, { color: accent }]}>{result.reachable ? `Responded - ${result.status ?? 'no status'}` : 'Could not reach it'}</Text>
      {!result.reachable ? <Text style={[typography.footnote1155, { color: colors.onDarkMuted, marginTop: 6 }]}>{result.error ?? ''}</Text> : null}
      {Object.entries(result.services).map(([name, state], i) => (
        <View key={name} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: i === 0 ? 10 : 4 }}>
          <Text style={[typography.body14, { color: colors.onDark }]}>{name}</Text>
          <Text style={[typography.meta12, { color: state === 'connected' ? colors.accent : colors.onDarkFaint }]}>{state}</Text>
        </View>
      ))}
    </View>
  );
}
