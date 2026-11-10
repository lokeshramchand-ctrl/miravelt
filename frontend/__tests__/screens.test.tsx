import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { ActivityIndicator } from 'react-native';
import LoginScreen from '../src/screens/LoginScreen';
import RegisterScreen from '../src/screens/RegisterScreen';
import SplashScreen from '../src/screens/SplashScreen';
import { LegalDocumentScreen, PrivacyPolicyScreen, TermsOfServiceScreen } from '../src/screens/LegalDocumentScreen';
import { privacyPolicyDocument, termsOfServiceDocument } from '../src/lib/legalDocuments';
import { useAuth } from '../src/state/auth';
import { useToast } from '../src/state/toast';

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const setField = (placeholder: string, value: string) => fireEvent.changeText(screen.getByPlaceholderText(placeholder), value);

describe('LoginScreen', () => {
  const login = jest.spyOn(useAuth.getState(), 'login');
  beforeEach(() => {
    login.mockReset();
    useAuth.setState({ status: 'unauthenticated', user: null, busy: false });
  });

  it('rejects an empty email', () => {
    renderWithQuery(<LoginScreen />);
    setField('you@example.com', '');
    setField('••••••••', 'TestPass123!');
    fireEvent.press(screen.getByText('Sign in'));
    expect(screen.getByText('Enter your email')).toBeTruthy();
  });

  it('rejects an email missing an @', () => {
    renderWithQuery(<LoginScreen />);
    setField('you@example.com', 'not-an-email');
    setField('••••••••', 'TestPass123!');
    fireEvent.press(screen.getByText('Sign in'));
    expect(screen.getByText('Enter a valid email')).toBeTruthy();
  });

  it('rejects an empty password', () => {
    renderWithQuery(<LoginScreen />);
    setField('you@example.com', 'test@miravelt.dev');
    setField('••••••••', '');
    fireEvent.press(screen.getByText('Sign in'));
    expect(screen.getByText('Enter your password')).toBeTruthy();
  });

  it('never reaches the loading state or the network for an invalid form', () => {
    renderWithQuery(<LoginScreen />);
    setField('you@example.com', '');
    setField('••••••••', '');
    fireEvent.press(screen.getByText('Sign in'));
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    expect(useAuth.getState().login).not.toHaveBeenCalled();
  });

  it('signs in with trimmed credentials when the form is valid', async () => {
    const spy = jest.fn().mockResolvedValue(undefined);
    useAuth.setState({ login: spy });
    renderWithQuery(<LoginScreen />);
    setField('you@example.com', '  test@miravelt.dev ');
    setField('••••••••', 'TestPass123!');
    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'));
    });
    expect(spy).toHaveBeenCalledWith('test@miravelt.dev', 'TestPass123!');
  });

  it('shows the API error as a toast when sign-in fails', async () => {
    useAuth.setState({ login: jest.fn().mockRejectedValue(new Error('boom')) });
    useToast.setState({ message: null });
    renderWithQuery(<LoginScreen />);
    setField('you@example.com', 'test@miravelt.dev');
    setField('••••••••', 'TestPass123!');
    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'));
    });
    expect(useToast.getState().message).toBe('Something went wrong. Please try again.');
  });
});

describe('RegisterScreen', () => {
  const fill = (email: string, password: string, confirm: string) => {
    setField('you@example.com', email);
    setField('At least 8 characters', password);
    setField('Re-enter your password', confirm);
    fireEvent.press(screen.getByText('Create account'));
  };

  it('rejects a password under 8 characters', () => {
    render(<RegisterScreen />);
    fill('test@miravelt.dev', 'short1', 'short1');
    expect(screen.getByText('Use at least 8 characters')).toBeTruthy();
  });

  it('rejects a password over 128 characters', () => {
    render(<RegisterScreen />);
    fill('test@miravelt.dev', 'a'.repeat(129), 'a'.repeat(129));
    expect(screen.getByText('Password is too long')).toBeTruthy();
  });

  it('rejects a confirm-password mismatch', () => {
    render(<RegisterScreen />);
    fill('test@miravelt.dev', 'TestPass123!', 'DoesNotMatch1');
    expect(screen.getByText("Passwords don't match")).toBeTruthy();
  });

  it('rejects an invalid email', () => {
    render(<RegisterScreen />);
    fill('not-an-email', 'TestPass123!', 'TestPass123!');
    expect(screen.getByText('Enter a valid email')).toBeTruthy();
  });
});

describe('SplashScreen', () => {
  it('shows the wordmark', () => {
    render(<SplashScreen />);
    expect(screen.getAllByText('Miravelt')).toHaveLength(1);
  });
});

describe('legal documents', () => {
  it('Privacy Policy names the developer, contact, and has every expected section', () => {
    expect(privacyPolicyDocument.title).toBe('Privacy Policy');
    expect(privacyPolicyDocument.intro).toContain('draft');
    const headings = privacyPolicyDocument.sections.map((s) => s.heading);
    expect(headings).toEqual(expect.arrayContaining(['Who this is', 'What data we collect', 'How your data is processed', 'Data retention and deletion', 'Security', 'Your rights']));
    const who = privacyPolicyDocument.sections.find((s) => s.heading === 'Who this is');
    expect(who?.body).toContain('Lokesh Ram Chand');
    expect(who?.body).toContain('lokeshramchand@gmail');
  });

  it('Terms of Service has every expected section', () => {
    expect(termsOfServiceDocument.title).toBe('Terms of Service');
    const headings = termsOfServiceDocument.sections.map((s) => s.heading);
    expect(headings).toEqual(expect.arrayContaining(['Who this is', "What Miravelt is (and isn't)", 'Your account', 'Acceptable use', 'Disclaimer and liability', 'Governing law']));
  });

  it('keeps the multi-line section bodies intact', () => {
    const collected = privacyPolicyDocument.sections.find((s) => s.heading === 'What data we collect');
    expect(collected?.body).toContain('\n\n');
    expect(collected?.body).not.toContain("\\'");
  });

  it('PrivacyPolicyScreen renders the title, last-updated line and every section', () => {
    render(<PrivacyPolicyScreen />);
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    expect(screen.getByText(new RegExp(privacyPolicyDocument.lastUpdated))).toBeTruthy();
    for (const section of privacyPolicyDocument.sections) expect(screen.getByText(section.heading)).toBeTruthy();
  });

  it('TermsOfServiceScreen renders the title', () => {
    render(<TermsOfServiceScreen />);
    expect(screen.getByText('Terms of Service')).toBeTruthy();
  });

  it('renders a minimal document with no sections', () => {
    render(<LegalDocumentScreen document={{ title: 'Empty', lastUpdated: '2026-01-01', intro: 'intro text', sections: [] }} />);
    expect(screen.getByText('Empty')).toBeTruthy();
    expect(screen.getByText('intro text')).toBeTruthy();
  });
});
