import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { backdrop, colors } from '../theme/colors';

/** The app-wide background: a soft gray wash that turns pale blue toward the bottom. */
export function Backdrop() {
  const stops = colors.scheme === 'dark' ? backdrop.dark : backdrop.light;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={stops} locations={[0, 0.45, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}
