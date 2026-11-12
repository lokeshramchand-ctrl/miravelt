import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { authRepository } from '../api/instance';
import { errorCode } from '../api/errors';
import { PrimaryPillButton } from '../components/Buttons';
import { ScreenBackHeader } from '../components/Controls';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { errorMessage } from '../state/auth';
import { showToast } from '../state/toast';
import { colors } from '../theme/colors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

export function validateResetRequest(email: string): string | undefined {
  if (!email.trim()) return 'Enter your email';
  if (!email.includes('@')) return 'Enter a valid email';
  return undefined;
}

export function validateNewPassword(password: string, confirm: string): { password?: string; confirm?: string } {
  const errors: { password?: string; confirm?: string } = {};
  if (password.length < 8) errors.password = 'Use at least 8 characters';
  if (confirm !== password) errors.confirm = 'The two passwords do not match';
  return errors;
}

export function validateResetCode(code: string): string | undefined {
  return /^\d{6}$/.test(code.trim()) ? undefined : 'Enter the 6-digit code from the email';
}

/**
 * Password reset by emailed code (PROJECT_AUDIT.md D3/F18). Step one asks for
 * the address and always says the same thing, so it never reveals whether an
 * account exists. Step two takes the code and a new password.
 */
export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string; confirm?: string }>({});

  const requestCode = async () => {
    const emailError = validateResetRequest(email);
    setErrors({ email: emailError });
    if (emailError) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      await authRepository.requestPasswordReset(email.trim().toLowerCase());
      setStep('code');
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const found = { code: validateResetCode(code), ...validateNewPassword(password, confirm) };
    setErrors(found);
    if (found.code || found.password || found.confirm) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      await authRepository.resetPassword(email.trim().toLowerCase(), code.trim(), password);
      showToast('Password changed. Sign in with the new one.', 'success');
      router.replace('/login');
    } catch (e) {
      if (errorCode(e) === 'invalid_code') setErrors({ code: 'That code is wrong or has expired' });
      else showToast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen dark>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: 6, paddingBottom: 32 }}>
          <ScreenBackHeader title="Reset password" onBack={() => (step === 'code' ? setStep('email') : router.back())} />
          <View style={{ height: 22 }} />
          {step === 'email' ? (
            <>
              <Text style={[typography.bigHeadline22, { color: colors.text }]}>Forgot your password?</Text>
              <Text style={[typography.footnote15, { color: colors.muted, marginTop: 8 }]}>Enter the email you signed up with and we will send a 6-digit code.</Text>
              <View style={{ height: 26 }} />
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
                returnKeyType="go"
                onSubmitEditing={requestCode}
                error={errors.email}
              />
              <View style={{ height: 26 }} />
              <PrimaryPillButton label="Send code" onPress={requestCode} loading={busy} />
            </>
          ) : (
            <>
              <Text style={[typography.bigHeadline22, { color: colors.text }]}>Check your email</Text>
              <Text style={[typography.footnote15, { color: colors.muted, marginTop: 8 }]}>
                If {email.trim()} has an account, a 6-digit code is on its way. It works once and expires in 30 minutes.
              </Text>
              <View style={{ height: 26 }} />
              <TextField
                label="CODE"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                error={errors.code}
              />
              <View style={{ height: 18 }} />
              <TextField
                label="NEW PASSWORD"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                revealable
                revealed={revealed}
                onToggleReveal={() => setRevealed((v) => !v)}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                error={errors.password}
              />
              <View style={{ height: 18 }} />
              <TextField
                label="REPEAT NEW PASSWORD"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Same again"
                revealable
                revealed={revealed}
                onToggleReveal={() => setRevealed((v) => !v)}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={reset}
                error={errors.confirm}
              />
              <View style={{ height: 26 }} />
              <PrimaryPillButton label="Change password" onPress={reset} loading={busy} />
              <Pressable accessibilityRole="button" disabled={busy} onPress={requestCode} style={{ alignSelf: 'center', paddingVertical: 14, marginTop: 4 }}>
                <Text style={[typography.footnote12, { color: colors.signalText }]}>Send a new code</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
