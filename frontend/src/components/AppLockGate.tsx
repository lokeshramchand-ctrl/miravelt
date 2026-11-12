import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { authenticate, shouldRelock } from '../lib/appLock';
import { useAuth } from '../state/auth';
import { useSettings } from '../state/settings';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { PrimaryPillButton } from './Buttons';
import { Icon } from './Icon';

/**
 * Covers the app until the person unlocks it, when Profile > "App lock" is on
 * and someone is signed in. Locks on cold start and again after the app has
 * been in the background for a minute. Rendered above the navigator, so no
 * screen behind it is visible or touchable while locked.
 */
export function AppLockGate() {
  const enabled = useSettings((s) => s.appLockEnabled);
  const signedIn = useAuth((s) => s.status === 'authenticated');
  const [locked, setLocked] = useState(enabled);
  const prompting = useRef(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await authenticate()) setLocked(false);
    } finally {
      prompting.current = false;
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active') {
        if (useSettings.getState().appLockEnabled && shouldRelock(backgroundedAt.current)) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => subscription.remove();
  }, []);

  const active = enabled && signedIn && locked;
  useEffect(() => {
    if (active) void unlock();
  }, [active, unlock]);

  if (!active) return null;
  return (
    <View
      accessibilityViewIsModal
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}
    >
      <Icon name="shield-check" size={44} color={colors.signal} />
      <Text accessibilityRole="header" style={[typography.bigHeadline22, { color: colors.text, marginTop: 18 }]}>
        Miravelt is locked
      </Text>
      <Text style={[typography.footnote15, { color: colors.muted, textAlign: 'center', marginTop: 10 }]}>Unlock with your fingerprint, face or device PIN.</Text>
      <View style={{ marginTop: 24 }}>
        <PrimaryPillButton label="Unlock" expand={false} onPress={() => void unlock()} testID="app-lock-unlock" />
      </View>
    </View>
  );
}
