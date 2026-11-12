import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Dialog } from './Dialog';

export interface FormDialogField {
  key: string;
  label: string;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'number-pad';
  maxLength?: number;
}

/**
 * A dialog with a few labelled fields (change password, confirm deletion,
 * enter a code). `onSubmit` resolves to an error message to keep it open, or
 * null when it is done; the dialog shows a spinner and blocks a second tap
 * while it runs.
 */
export function FormDialog({ visible, title, message, fields, submitLabel, danger = false, onSubmit, onCancel }: {
  visible: boolean;
  title: string;
  message?: string;
  fields: FormDialogField[];
  submitLabel: string;
  danger?: boolean;
  onSubmit: (values: Record<string, string>) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setError(await onSubmit(values));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      title={title}
      message={message}
      onRequestClose={busy ? undefined : onCancel}
      actions={[
        { label: 'Cancel', tone: 'muted', onPress: () => (busy ? undefined : onCancel()) },
        { label: submitLabel, tone: danger ? 'danger' : 'accent', onPress: () => void submit() },
      ]}
    >
      {fields.map((field, i) => (
        <View key={field.key} style={{ marginTop: i === 0 ? 0 : 12 }}>
          <Text style={[typography.microLabel11, { color: colors.faint, marginBottom: 6 }]}>{field.label.toUpperCase()}</Text>
          <TextInput
            accessibilityLabel={field.label}
            autoFocus={i === 0}
            editable={!busy}
            value={values[field.key] ?? ''}
            onChangeText={(text) => {
              setValues((v) => ({ ...v, [field.key]: text }));
              setError(null);
            }}
            placeholder={field.placeholder}
            placeholderTextColor={colors.faint}
            secureTextEntry={field.secure}
            keyboardType={field.keyboardType}
            maxLength={field.maxLength}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={colors.signal}
            style={[typography.body14, styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: error ? colors.down : colors.border2 }]}
          />
        </View>
      ))}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[typography.footnote1155, { color: colors.down, marginTop: 8 }]}>
          {error}
        </Text>
      ) : null}
      {busy ? <ActivityIndicator size="small" color={colors.signal} style={{ marginTop: 12 }} /> : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12 },
});
