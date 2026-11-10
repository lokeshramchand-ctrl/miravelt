import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Ref } from 'react';
import type { TextInputProps } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  ref?: Ref<TextInput>;
  label?: string;
  error?: string | null;
  /** Adds a show/hide eye toggle (the field's own `secureTextEntry` is then controlled by it). */
  revealable?: boolean;
  /** Visibility shared across sibling fields (register's two password boxes). */
  revealed?: boolean;
  onToggleReveal?: () => void;
}

/** The dark form field used across sign-in/register/password prompts: tracked label, ink850 fill, hairline→accent focus border, rose on error. */
export function TextField({ ref, label, error, revealable, revealed, onToggleReveal, onFocus, onBlur, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [localRevealed, setLocalRevealed] = useState(false);
  const isRevealed = revealed ?? localRevealed;
  const toggle = onToggleReveal ?? (() => setLocalRevealed((v) => !v));
  return (
    <View>
      {label ? <Text style={[typography.microLabel11, { color: colors.onDarkFaint, marginBottom: 8 }]}>{label}</Text> : null}
      <View style={[styles.field, { borderColor: error ? colors.rose : focused ? colors.accent : colors.hairlineDark }]}>
        <TextInput
          {...input}
          ref={ref}
          secureTextEntry={revealable ? !isRevealed : input.secureTextEntry}
          placeholderTextColor={colors.onDarkFaint}
          selectionColor={colors.accent}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[typography.body14, styles.input, { color: colors.onDark }]}
        />
        {revealable ? (
          <Pressable accessibilityRole="button" accessibilityLabel={isRevealed ? 'Hide password' : 'Show password'} onPress={toggle} hitSlop={8} style={{ paddingHorizontal: 12 }}>
            <MaterialIcons name={isRevealed ? 'visibility' : 'visibility-off'} size={20} color={colors.onDarkFaint} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[typography.footnote1155, { color: colors.rose, marginTop: 6 }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ink850, borderWidth: 1, borderRadius: 12 },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
});
