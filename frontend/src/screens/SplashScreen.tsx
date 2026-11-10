import { ActivityIndicator, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Purely the loading visual while the stored session resolves - routing off
 * auth state happens in the root layout's redirect (see lib/redirect.ts).
 * Wordmark only: the app's logo mark is deliberately not shown inside the app
 * (it lives on the launcher icon alone).
 */
export default function SplashScreen() {
  return (
    <Screen dark>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[typography.wordmark14, { color: colors.onDark }]}>Miravelt</Text>
        <View style={{ height: 28 }} />
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    </Screen>
  );
}
