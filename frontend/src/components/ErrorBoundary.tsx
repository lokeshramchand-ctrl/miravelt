import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Text, View } from 'react-native';
import { reportError } from '../lib/telemetry';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { PrimaryPillButton } from './Buttons';
import { Icon } from './Icon';

/**
 * Catches a render error anywhere below it, reports it (lib/telemetry.ts) and
 * shows a way back, instead of the blank white screen an uncaught render
 * error leaves behind (PROJECT_AUDIT.md F26).
 */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { fatal: true, screen: (info.componentStack ?? '').trim().split('\n')[0]?.trim().slice(0, 120) });
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg }}>
        <Icon name="error-outline" size={40} color={colors.down} />
        <Text accessibilityRole="header" style={[typography.bigHeadline22, { color: colors.text, textAlign: 'center', marginTop: 16 }]}>
          Something went wrong
        </Text>
        <Text style={[typography.footnote15, { color: colors.muted, textAlign: 'center', marginTop: 10 }]}>
          This screen hit an error. Your data is safe - nothing was changed. The error has been reported.
        </Text>
        <View style={{ marginTop: 22 }}>
          <PrimaryPillButton label="Try again" expand={false} onPress={this.reset} testID="error-boundary-retry" />
        </View>
      </View>
    );
  }
}
