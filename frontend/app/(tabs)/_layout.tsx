import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppUpdateSheetHost } from '../../src/components/AppUpdateSheet';
import { FloatingBottomNav } from '../../src/components/Controls';
import type { NavTabSpec } from '../../src/components/Controls';
import { useAppUpdate } from '../../src/state/appUpdate';
import { colors } from '../../src/theme/colors';

const TABS: (NavTabSpec & { name: string })[] = [
  { name: 'overview', label: 'Overview', icon: 'dashboard' },
  { name: 'signals', label: 'Signals', icon: 'bolt' },
  { name: 'activity', label: 'Activity', icon: 'receipt-long' },
];

/**
 * Hosts the 3-tab shell (Overview/Signals/Activity) with the design's floating
 * pill nav absolutely positioned over the content, rather than a standard
 * bottom tab bar. Screens stay mounted across tab switches.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Fire-and-forget, once per app launch (this shell is only ever built once).
  // Never blocks navigation: it only surfaces a sheet if it finds something
  // newer than the installed build.
  useEffect(() => {
    void useAppUpdate.getState().checkForUpdate();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Tabs
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}
        tabBar={({ state, navigation }) => (
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 22, right: 22, bottom: 12 + insets.bottom, alignItems: 'center' }}>
            <FloatingBottomNav
              tabs={TABS}
              currentIndex={state.index}
              onPress={(index) => {
                const route = state.routes[index];
                const focused = state.index === index;
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          </View>
        )}
      >
        {TABS.map((t) => (
          <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
        ))}
      </Tabs>
      <AppUpdateSheetHost />
    </View>
  );
}
