import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { motion } from '../theme/tokens';
import { typography } from '../theme/typography';
import { nativeDriver, PressableScale } from './motion';

interface DialogAction {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'accent' | 'danger' | 'muted';
}

/** A confirmation dialog (bencho `.modal`): pops in with a spring; actions are pill buttons, the last one primary. */
export function Dialog({ visible, title, message, children, actions, onRequestClose }: { visible: boolean; title: string; message?: string; children?: React.ReactNode; actions: DialogAction[]; onRequestClose?: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, ...motion.spring, useNativeDriver: nativeDriver }).start();
    }
  }, [visible, pop]);
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onRequestClose}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }, Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)' } as object) : null]}>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            { backgroundColor: colors.solid, borderColor: colors.border, opacity: pop, transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }, { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] },
            shadows.liftHi(),
          ]}
        >
          <Text style={[typography.bigHeadline22, { fontSize: 19, color: colors.text }]}>{title}</Text>
          {message ? <Text style={[typography.body14, { color: colors.muted, marginTop: 8 }]}>{message}</Text> : null}
          {children ? <View style={{ marginTop: 14 }}>{children}</View> : null}
          <View style={styles.actions}>
            {actions.map((a, i) => {
              const primary = i === actions.length - 1;
              const danger = a.tone === 'danger';
              const bg = primary ? (danger ? colors.down : colors.ink) : colors.surface;
              const fg = primary ? (danger ? '#ffffff' : colors.onInk) : colors.text;
              return (
                <PressableScale
                  key={a.label}
                  accessibilityRole="button"
                  onPress={a.onPress}
                  style={({ pressed }) => [styles.action, { backgroundColor: bg, borderColor: primary ? bg : colors.border2, marginLeft: i === 0 ? 0 : 8 }, pressed && { opacity: 0.85 }]}
                >
                  <Text style={[typography.buttonLabel14, { color: fg }]}>{a.label}</Text>
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>
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
  const [focused, setFocused] = useState(false);
  return (
    <Dialog
      visible={visible}
      title={title}
      message={message}
      onRequestClose={onCancel}
      actions={[
        { label: 'Cancel', tone: 'muted', onPress: onCancel },
        { label: submitLabel, tone: 'accent', onPress: () => setError(onSubmit(value)) },
      ]}
    >
      <TextInput
        autoFocus
        value={value}
        onChangeText={(t) => {
          setValue(t);
          setError(null);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={colors.signal}
        style={[typography.body14, styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: error ? colors.down : focused ? colors.signal : colors.border2 }, focused && ({ boxShadow: `0 0 0 4px ${colors.signalSoft}` } as object)]}
      />
      {error ? <Text style={[typography.footnote1155, { color: colors.down, marginTop: 6 }]}>{error}</Text> : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: 22, padding: 22, borderWidth: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  action: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12 },
});
