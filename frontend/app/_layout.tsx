import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack, router, usePathname, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authRepository, eventsRepository } from '../src/api/instance';
import { AppLockGate } from '../src/components/AppLockGate';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { PeriodSwitcherHost } from '../src/components/PeriodSwitcherSheet';
import { ToastHost } from '../src/components/Toast';
import { UploadSheetHost } from '../src/components/UploadSheet';
import { invalidatePeriods, usePeriods } from '../src/hooks/periods';
import '../src/lib/textScaling';
import { initNotifications } from '../src/lib/notifications';
import { registerForPush } from '../src/lib/push';
import { queryClient } from '../src/lib/queryClient';
import { persistOptions } from '../src/lib/queryPersistence';
import { computeRedirect } from '../src/lib/redirect';
import { configureTelemetry, flush as flushTelemetry, installGlobalErrorHandler, track } from '../src/lib/telemetry';
import { useSession } from '../src/state/session';
import { useAuth } from '../src/state/auth';
import { useSettings } from '../src/state/settings';
import { applyColorScheme, colors } from '../src/theme/colors';
import { useColorSchemeSetting } from '../src/theme/useTheme';

void SplashScreen.preventAutoHideAsync();

// Crash reports and usage events go to our own backend, and only when the
// person switched them on (Profile > Privacy) and is signed in.
configureTelemetry({
  send: (events, appVersion, platform) => eventsRepository.send(events, appVersion, platform),
  isEnabled: () => useSettings.getState().shareDiagnostics && useAuth.getState().status === 'authenticated',
});
installGlobalErrorHandler();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const hydrated = useSettings((s) => s.hydrated);

  useEffect(() => {
    void initNotifications();
    // The session check talks to the stored backend, so settings must be read first.
    void useSettings
      .getState()
      .hydrate()
      .then(() => useAuth.getState().bootstrap());
  }, []);

  // A font that fails to load degrades to the system font rather than blocking launch.
  const ready = (fontsLoaded || fontError != null) && hydrated;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* The cache is restored from disk before the first query runs, so a
            processed period opens instantly and offline (D2). Once restored,
            the period list is refreshed in the background; analytics follow
            through their revision-keyed queries. */}
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions} onSuccess={() => void invalidatePeriods()}>
          <ErrorBoundary onReset={() => router.replace('/')}>
            <Shell />
          </ErrorBoundary>
          <AppLockGate />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  // Swap the palette before anything below reads it. Keying the navigator on the scheme
  // repaints every mounted screen (react-navigation memoizes scenes, so a plain re-render
  // would leave them on the old colours); RedirectGate then returns to the same route.
  const scheme = useColorSchemeSetting();
  applyColorScheme(scheme);
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RedirectGate />
      <Stack key={scheme} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      </Stack>
      <UploadSheetHost />
      <PeriodSwitcherHost />
      <ToastHost />
      <SessionEffects />
    </>
  );
}

/**
 * Things that follow from being signed in: this device registers for server
 * push, and tapping a "period ready" notification opens that period.
 */
function SessionEffects() {
  const signedIn = useAuth((s) => s.status === 'authenticated');
  const wantsPush = useSettings((s) => s.notifyAnalysisFinished);

  useEffect(() => {
    if (!signedIn) return;
    track('app_opened');
    if (wantsPush) void registerForPush({ register: authRepository.registerPushToken, unregister: authRepository.unregisterPushToken });
    return () => void flushTelemetry();
  }, [signedIn, wantsPush]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string; statement_id?: string } | undefined;
      if (data?.type !== 'statement_ready' || !data.statement_id) return;
      useSession.getState().selectPeriod(data.statement_id);
      void invalidatePeriods();
      router.replace('/overview');
    });
    return () => subscription.remove();
  }, []);

  return null;
}

/**
 * Sends the user where their auth + periods say they belong (see
 * lib/redirect.ts). Starts on the splash (`/`) and holds there while the stored
 * session is checked, so a signed-in user never sees the login form flash up.
 */
function RedirectGate() {
  const pathname = usePathname();
  const navigationReady = useRootNavigationState()?.key != null;
  const authStatus = useAuth((s) => s.status);
  const introSeen = useSettings((s) => s.introSeen);
  const periods = usePeriods();

  const target = computeRedirect({
    pathname,
    authStatus,
    introSeen,
    periods: {
      loading: periods.isFetching || (periods.data === undefined && !periods.isError),
      hasData: periods.data !== undefined,
      failed: periods.isError && periods.data === undefined,
      data: periods.data,
    },
  });

  useEffect(() => {
    if (navigationReady && target && target !== pathname) router.replace(target);
  }, [navigationReady, target, pathname]);

  return null;
}
