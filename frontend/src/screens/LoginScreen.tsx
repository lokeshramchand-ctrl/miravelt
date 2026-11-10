import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import type { TextInput } from 'react-native';
import { PrimaryPillButton } from '../components/Buttons';
import { DeveloperUnlockGesture, versionLabel } from '../components/DeveloperSettings';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { appConfig } from '../config/appConfig';
import { usePeriods } from '../hooks/periods';
import { errorMessage, useAuth } from '../state/auth';
import { showToast } from '../state/toast';
import { colors } from '../theme/colors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

export function validateLogin(email: string, password: string): { email?: string; password?: string } {
  const errors: { email?: string; password?: string } = {};
  if (!email.trim()) errors.email = 'Enter your email';
  else if (!email.includes('@')) errors.email = 'Enter a valid email';
  if (!password) errors.password = 'Enter your password';
  return errors;
}

export default function LoginScreen() {
  const status = useAuth((s) => s.status);
  const busy = useAuth((s) => s.busy);
  // Signed in but still on this screen means the redirect is waiting for the
  // user's periods to pick Overview vs onboarding - keep the button busy
  // through that too, or the form looks idle after a successful sign-in.
  const periods = usePeriods();
  const loadingPeriods = status === 'authenticated' && periods.isFetching;
  const loading = busy || loadingPeriods;

  // Debug-only: __DEV__ is false in release builds, so this never ships.
  const [email, setEmail] = useState(__DEV__ ? appConfig.devEmail : '');
  const [password, setPassword] = useState(__DEV__ ? appConfig.devPassword : '');
  const [revealed, setRevealed] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validateLogin>>({});
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    const found = validateLogin(email, password);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    Keyboard.dismiss();
    try {
      await useAuth.getState().login(email.trim(), password);
    } catch (e) {
      showToast(errorMessage(e), 'error');
    }
  };

  return (
    <Screen dark>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingVertical: 32 }}>
          <Text style={[typography.bigHeadline26, { color: colors.onDark }]}>Welcome back</Text>
          <Text style={[typography.footnote15, { color: colors.onDarkMuted, marginTop: 8 }]}>Sign in to see your spending, explained.</Text>
          <View style={{ height: 32 }} />
          <TextField
            label="EMAIL"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={errors.email}
          />
          <View style={{ height: 18 }} />
          <TextField
            ref={passwordRef}
            label="PASSWORD"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            revealable
            revealed={revealed}
            onToggleReveal={() => setRevealed((v) => !v)}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            error={errors.password}
          />
          <View style={{ height: 28 }} />
          <PrimaryPillButton label="Sign in" onPress={submit} loading={loading} />
          <Pressable accessibilityRole="button" onPress={() => router.push('/register')} style={{ alignSelf: 'center', paddingVertical: 14, marginTop: 4 }}>
            <Text style={[typography.footnote12, { color: colors.accentDim }]}>Don't have an account? Create one</Text>
          </Pressable>
          <View style={{ height: 40 }} />
          {/* The only entry point to Developer settings that works when the backend is down - Profile is behind a successful sign-in, which is exactly what an unreachable backend prevents. */}
          <DeveloperUnlockGesture>
            <Text style={[typography.footnote12, { color: colors.onDarkFaint, textAlign: 'center' }]}>Version {versionLabel()}</Text>
          </DeveloperUnlockGesture>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
