import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface ScreenProps {
  children: React.ReactNode;
  /** Surface the screen sits on: dark ink or light paper. */
  dark?: boolean;
  /** Pad for the status bar / home indicator. Off for screens that paint their own header band edge-to-edge. */
  safeTop?: boolean;
  safeBottom?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A full-screen surface with the right background and status-bar icons for its colour. */
export function Screen({ children, dark = false, safeTop = true, safeBottom = false, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: dark ? colors.ink900 : colors.paper, paddingTop: safeTop ? insets.top : 0, paddingBottom: safeBottom ? insets.bottom : 0 }, style]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {children}
    </View>
  );
}
