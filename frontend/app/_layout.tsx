import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, router, usePathname, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PeriodSwitcherHost } from '../src/components/PeriodSwitcherSheet';
import { ToastHost } from '../src/components/Toast';
import { UploadSheetHost } from '../src/components/UploadSheet';
import { usePeriods } from '../src/hooks/periods';
import '../src/lib/textScaling';
import { initNotifications } from '../src/lib/notifications';
import { queryClient } from '../src/lib/queryClient';
import { computeRedirect } from '../src/lib/redirect';
import { useAuth } from '../src/state/auth';
import { useSettings } from '../src/state/settings';
import { useTheme } from '../src/theme/useTheme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
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
        <QueryClientProvider client={queryClient}>
          <Shell />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const { background } = useTheme();
  return (
    <>
      <StatusBar style="auto" />
      <RedirectGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background }, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      </Stack>
      <UploadSheetHost />
      <PeriodSwitcherHost />
      <ToastHost />
    </>
  );
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
  const periods = usePeriods();

  const target = computeRedirect({
    pathname,
    authStatus,
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
