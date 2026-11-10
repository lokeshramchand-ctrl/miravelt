import { useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { PrimaryPillButton } from '../components/Buttons';
import { ScreenBackHeader } from '../components/Controls';
import { useShake } from '../components/Delight';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { errorMessage, useAuth } from '../state/auth';
import { showToast } from '../state/toast';
import { colors } from '../theme/colors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { router } from 'expo-router';
import { useRef } from 'react';
import type { TextInput } from 'react-native';

export function validateRegister(email: string, password: string, confirm: string): { email?: string; password?: string; confirm?: string } {
  const errors: { email?: string; password?: string; confirm?: string } = {};
  if (!email.trim()) errors.email = 'Enter your email';
  else if (!email.includes('@')) errors.email = 'Enter a valid email';
  if (password.length < 8) errors.password = 'Use at least 8 characters';
  else if (password.length > 128) errors.password = 'Password is too long';
  if (confirm !== password) errors.confirm = "Passwords don't match";
  return errors;
}

export default function RegisterScreen() {
  const busy = useAuth((s) => s.busy);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validateRegister>>({});
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const { shake, style: shakeStyle } = useShake();

  const submit = async () => {
    const found = validateRegister(email, password, confirm);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      shake();
      return;
    }
    Keyboard.dismiss();
    try {
      await useAuth.getState().registerAndLogin(email.trim(), password);
    } catch (e) {
      shake();
      showToast(errorMessage(e), 'error');
    }
  };

  return (
    <Screen dark>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: 24 }}>
          <View style={{ height: 8 }} />
          <ScreenBackHeader />
          <Text style={[typography.bigHeadline26, { color: colors.text, marginTop: 12 }]}>Create your account</Text>
          <Text style={[typography.footnote15, { color: colors.muted, marginTop: 8 }]}>One account, every statement you add.</Text>
          <View style={{ height: 28 }} />
          <Animated.View style={shakeStyle}>
          <TextField
            label="EMAIL"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
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
            placeholder="At least 8 characters"
            revealable
            revealed={revealed}
            onToggleReveal={() => setRevealed((v) => !v)}
            autoCapitalize="none"
            autoComplete="new-password"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            error={errors.password}
          />
          <View style={{ height: 18 }} />
          <TextField
            ref={confirmRef}
            label="CONFIRM PASSWORD"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter your password"
            secureTextEntry={!revealed}
            autoCapitalize="none"
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={submit}
            error={errors.confirm}
          />
          </Animated.View>
          <View style={{ height: 28 }} />
          <PrimaryPillButton label="Create account" onPress={submit} loading={busy} />
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ alignSelf: 'center', paddingVertical: 14, marginTop: 6 }}>
            <Text style={[typography.footnote12, { color: colors.signalText }]}>Already have an account? Sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
