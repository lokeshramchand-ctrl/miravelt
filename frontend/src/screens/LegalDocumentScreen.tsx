import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenBackHeader } from '../components/Controls';
import { Screen } from '../components/Screen';
import type { LegalDocument } from '../lib/legalDocuments';
import { privacyPolicyDocument, termsOfServiceDocument } from '../lib/legalDocuments';
import { colors } from '../theme/colors';
import { spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { withAlpha } from '../components/Display';

export function LegalDocumentScreen({ document }: { document: LegalDocument }) {
  const insets = useSafeAreaInsets();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: 6, paddingBottom: 32 + insets.bottom }}>
        <ScreenBackHeader title={document.title} titleStyle={typography.screenTitle24} dark={false} />
        <Text style={[typography.meta12, { color: colors.faint, marginTop: 4 }]}>Last updated {document.lastUpdated}</Text>
        <View style={{ marginTop: 16, padding: 14, backgroundColor: withAlpha(colors.warn, 0.12), borderRadius: 12 }}>
          <Text style={[typography.footnote15, { color: colors.text, lineHeight: 15 * 1.5 }]}>{document.intro}</Text>
        </View>
        <View style={{ height: 26 }} />
        {document.sections.map((section) => (
          <View key={section.heading} style={{ marginBottom: 24 }}>
            <Text style={[typography.rowLabel14, { color: colors.text, fontSize: 16 }]}>{section.heading}</Text>
            <Text style={[typography.footnote15, { color: colors.muted, lineHeight: 15 * 1.55, marginTop: 8 }]}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

export function PrivacyPolicyScreen() {
  return <LegalDocumentScreen document={privacyPolicyDocument} />;
}

export function TermsOfServiceScreen() {
  return <LegalDocumentScreen document={termsOfServiceDocument} />;
}
