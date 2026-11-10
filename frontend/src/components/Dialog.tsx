import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface DialogAction {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'accent' | 'danger' | 'muted';
}

const TONE = { default: colors.onDark, accent: colors.accent, danger: colors.rose, muted: colors.onDarkMuted } as const;

/** A dark alert dialog: title, body (text or custom content) and a row of text actions. */
export function Dialog({ visible, title, message, children, actions, onRequestClose }: { visible: boolean; title: string; message?: string; children?: React.ReactNode; actions: DialogAction[]; onRequestClose?: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onRequestClose}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={[typography.rowLabel14, { color: colors.onDark, fontSize: 16 }]}>{title}</Text>
          {message ? <Text style={[typography.footnote12, { color: colors.onDarkMuted, marginTop: 10 }]}>{message}</Text> : null}
          {children ? <View style={{ marginTop: 14 }}>{children}</View> : null}
          <View style={styles.actions}>
            {actions.map((a) => (
              <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress} hitSlop={6} style={({ pressed }) => [{ paddingHorizontal: 12, paddingVertical: 8 }, pressed && { opacity: 0.6 }]}>
                <Text style={[typography.buttonLabel14, { color: TONE[a.tone ?? 'default'] }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** A dialog with one text field (edit name, custom backend URL). `onSubmit` returns an error to keep it open, or null to close. */
export function PromptDialog({ visible, title, message, initialValue, placeholder, keyboardType, submitLabel = 'Save', onSubmit, onCancel }: {
  visible: boolean;
  title: string;
  message?: string;
  initialValue: string;
  placeholder?: string;
  keyboardType?: 'default' | 'url';
  submitLabel?: string;
  onSubmit: (value: string) => string | null;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      visible={visible}
      title={title}
      message={message}
      onRequestClose={onCancel}
      actions={[
        { label: 'Cancel', tone: 'muted', onPress: onCancel },
        {
          label: submitLabel,
          tone: 'accent',
          onPress: () => {
            const problem = onSubmit(value);
            setError(problem);
          },
        },
      ]}
    >
      <TextInput
        autoFocus
        value={value}
        onChangeText={(t) => {
          setValue(t);
          setError(null);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.onDarkFaint}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={colors.accent}
        style={[typography.body14, styles.input, { color: colors.onDark, borderColor: error ? colors.rose : colors.hairlineDark }]}
      />
      {error ? <Text style={[typography.footnote1155, { color: colors.rose, marginTop: 6 }]}>{error}</Text> : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrimHeavy, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.ink850, borderRadius: 24, padding: 22, borderWidth: 1, borderColor: colors.hairlineDark },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18, marginRight: -8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: colors.ink900 },
});
