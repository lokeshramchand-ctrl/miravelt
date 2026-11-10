import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryPillButton } from '../components/Buttons';
import { Screen } from '../components/Screen';
import { startUploadFlow } from '../state/upload';
import { colors } from '../theme/colors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const HEIGHTS = [0.3, 0.5, 0.42, 0.68, 0.5, 0.85, 1.0];

/** Doubles as Overview's empty state when the user has zero periods. */
export default function OnboardingScreen() {
  return (
    <Screen dark safeBottom>
      <View style={{ flex: 1, paddingHorizontal: spacing.md + 8, paddingTop: 20, paddingBottom: 30 }}>
        <Text style={[typography.wordmark14, { color: colors.onDark }]}>Miravelt</Text>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ height: 26 }} />
          <MiniIllustration />
          <Text style={[typography.bigHeadline32, { color: colors.onDark, marginTop: 26 }]}>Six months of spending, explained in a minute.</Text>
          <Text style={[typography.footnote15, { color: colors.onDarkMuted, marginTop: 14 }]}>
            Add one Google Pay statement. Miravelt reads every transaction, names the merchants, finds the patterns and tells you what changed.
          </Text>
          <View style={{ height: 24 }} />
          <NumberedStep n={1} text="Open Google Pay → Transaction statement" />
          <NumberedStep n={2} text="Pick any date range and export the PDF" />
          <NumberedStep n={3} text="Add it here - analysis takes under a minute" />
        </ScrollView>
        <View style={{ height: 26 }} />
        <PrimaryPillButton label="Add your first statement" onPress={startUploadFlow} />
        <Text style={[typography.microLabel11, { color: colors.onDarkFaint, textAlign: 'center', marginTop: 14 }]}>Stays on your account. Never shared, never sold.</Text>
      </View>
    </Screen>
  );
}

function NumberedStep({ n, text }: { n: number; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
      <View style={styles.stepBadge}>
        <Text style={[typography.microLabelTracked105, { color: colors.accent, fontSize: 11 }]}>{n}</Text>
      </View>
      <Text style={[typography.cardBody135, { color: colors.onDarkMuted, flex: 1, marginLeft: 12 }]}>{text}</Text>
    </View>
  );
}

function MiniIllustration() {
  return (
    <View style={{ height: 120, flexDirection: 'row', alignItems: 'flex-end' }}>
      {HEIGHTS.map((h, i) => (
        <View key={i} style={{ flex: 1, height: `${h * 100}%`, paddingHorizontal: 3 }}>
          <View
            style={{
              flex: 1,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              backgroundColor: i === HEIGHTS.length - 1 ? colors.accent : i === HEIGHTS.length - 3 ? colors.accentDim : 'rgba(255, 255, 255, 0.09)',
            }}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stepBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink800, borderWidth: 1, borderColor: colors.hairlineDark },
});
