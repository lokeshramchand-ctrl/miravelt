import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
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
import { applyColorScheme, colors } from '../src/theme/colors';
import { useColorSchemeSetting } from '../src/theme/useTheme';

void SplashScreen.preventAutoHideAsync();

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
        <QueryClientProvider client={queryClient}>
          <Shell />
        </QueryClientProvider>
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
