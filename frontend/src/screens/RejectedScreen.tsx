import { router, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, Text, View } from 'react-native';
import { PrimaryPillButton, SecondaryPillButton } from '../components/Buttons';
import { ScreenBackHeader } from '../components/Controls';
import { Screen } from '../components/Screen';
import { startUploadFlow } from '../state/upload';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

const DEFAULT_MESSAGE =
  'We look for the "Transaction statement" header and UPI transaction IDs. This file has neither - it may be a bank statement or an invoice.';

export default function RejectedScreen() {
  const { message } = useLocalSearchParams<{ message?: string }>();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/overview'));

  return (
    <Screen>
      <View style={{ flex: 1, paddingHorizontal: spacing.gutter, paddingTop: 16, paddingBottom: 28 }}>
        <ScreenBackHeader dark={false} centerTitle="Add statement" onBack={goBack} />
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ height: 8 }} />
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.downSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[typography.amountSmall22, { color: colors.down }]}>!</Text>
          </View>
          <Text style={[typography.bigHeadline26, { color: colors.text, marginTop: 18 }]}>This PDF isn't a Google Pay statement</Text>
          <Text style={[typography.body14, { color: colors.muted, lineHeight: 14 * 1.55, marginTop: 10 }]}>{message || DEFAULT_MESSAGE}</Text>
          <View style={{ marginTop: 22, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card }}>
            <Text style={[typography.microLabelTracked105, { color: colors.faint }]}>HOW TO GET THE RIGHT FILE</Text>
            <View style={{ height: 12 }} />
            <Step n="01" text="Google Pay → profile → Transaction statement" />
            <Step n="02" text="Choose a date range, tap Get statement" />
            <Step n="03" text="Share the PDF straight into Miravelt" last />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.faint }} />
            <Text style={[typography.microLabel11, { color: colors.faint, flex: 1, marginLeft: 8 }]}>Nothing was saved. Your other periods are untouched.</Text>
          </View>
        </ScrollView>
        <View style={{ height: 18 }} />
        <PrimaryPillButton
          label="Choose a different file"
          onPress={() => {
            goBack();
            startUploadFlow();
          }}
        />
        <View style={{ height: 12 }} />
        <SecondaryPillButton label="Open Google Pay" foreground={colors.text} borderColor={colors.border} onPress={() => void Linking.openURL('https://pay.google.com')} />
      </View>
    </Screen>
  );
}

function Step({ n, text, last = false }: { n: string; text: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: last ? 0 : 10 }}>
      <Text style={[typography.microLabelTracked11, { color: colors.signalText }]}>{n}</Text>
      <Text style={[typography.body13, { color: colors.text, flex: 1, marginLeft: 10 }]}>{text}</Text>
    </View>
  );
}
