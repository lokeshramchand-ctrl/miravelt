import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { Backdrop } from './Backdrop';

interface ScreenProps {
  children: React.ReactNode;
  /** Kept for call-site compatibility; every screen now sits on the theme's paper `bg`. */
  dark?: boolean;
  /** Pad for the status bar / home indicator. Off for screens that paint their own header band edge-to-edge. */
  safeTop?: boolean;
  safeBottom?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A full-screen surface on the gradient backdrop, with status-bar icons that read on it. */
export function Screen({ children, safeTop = true, safeBottom = false, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg, paddingTop: safeTop ? insets.top : 0, paddingBottom: safeBottom ? insets.bottom : 0 }, style]}>
      <Backdrop />
      <StatusBar style={colors.scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </View>
  );
}
