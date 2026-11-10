import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Ref } from 'react';
import type { TextInputProps } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  ref?: Ref<TextInput>;
  label?: string;
  error?: string | null;
  icon?: IconName;
  /** Adds a show/hide eye toggle (the field's own `secureTextEntry` is then controlled by it). */
  revealable?: boolean;
  /** Visibility shared across sibling fields (register's two password boxes). */
  revealed?: boolean;
  onToggleReveal?: () => void;
}

/** Form field (bencho `.input`): muted label, surface fill, `--border-2` hairline, signal border + soft focus ring, rose on error. */
export function TextField({ ref, label, error, icon, revealable, revealed, onToggleReveal, onFocus, onBlur, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [localRevealed, setLocalRevealed] = useState(false);
  const isRevealed = revealed ?? localRevealed;
  const toggle = onToggleReveal ?? (() => setLocalRevealed((v) => !v));
  const ring = focused && !error ? (Platform.OS === 'web' ? ({ boxShadow: `0 0 0 4px ${colors.signalSoft}` } as object) : { shadowColor: colors.signal, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }) : null;
  return (
    <View>
      {label ? <Text style={[typography.label13, { color: colors.text, marginBottom: 7 }]}>{label.charAt(0) + label.slice(1).toLowerCase()}</Text> : null}
      <View style={[styles.field, { backgroundColor: colors.surface, borderColor: error ? colors.down : focused ? colors.signal : colors.border2 }, ring]}>
        {icon ? <Icon name={icon} size={17} color={focused ? colors.signalText : colors.faint} style={{ marginLeft: 13 }} /> : null}
        <TextInput
          {...input}
          ref={ref}
          secureTextEntry={revealable ? !isRevealed : input.secureTextEntry}
          placeholderTextColor={colors.faint}
          selectionColor={colors.signal}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[typography.body14, styles.input, { color: colors.text, paddingLeft: icon ? 10 : 14 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
        />
        {revealable ? (
          <Pressable accessibilityRole="button" accessibilityLabel={isRevealed ? 'Hide password' : 'Show password'} onPress={toggle} hitSlop={8} style={{ paddingHorizontal: 13 }}>
            <Icon name={isRevealed ? 'visibility' : 'visibility-off'} size={19} color={colors.faint} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <Icon name="error-outline" size={13} color={colors.down} />
          <Text style={[typography.footnote1155, { color: colors.down, marginLeft: 5 }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  input: { flex: 1, paddingRight: 14, paddingVertical: 13 },
});
