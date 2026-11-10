import type { Statement } from '../domain/types';
import type { AuthStatus } from '../state/auth';

export const ROUTES = {
  splash: '/',
  login: '/login',
  register: '/register',
  welcome: '/welcome',
  onboarding: '/onboarding',
  overview: '/overview',
  signals: '/signals',
  activity: '/activity',
} as const;

const TAB_PATHS: readonly string[] = [ROUTES.overview, ROUTES.signals, ROUTES.activity];

export interface RedirectInput {
  pathname: string;
  authStatus: AuthStatus;
  periods: {
    /** A fetch (initial or refresh) is in flight. */
    loading: boolean;
    /** The list loaded at least once. */
    hasData: boolean;
    /** The last load failed and there is nothing cached to fall back on. */
    failed: boolean;
    data: readonly Statement[] | undefined;
  };
  /** Whether the welcome tour was finished or skipped. Omitted means yes (straight to sign in). */
  introSeen?: boolean;
}

/**
 * Where the app should be, given auth and the user's periods - or null to stay
 * put. A pure function of its input so the launch/sign-in/onboarding rules can
 * be tested without mounting a navigator.
 */
export function computeRedirect({ pathname, authStatus, periods, introSeen = true }: RedirectInput): string | null {
  const onSplash = pathname === ROUTES.splash;
  const onAuthPages = pathname === ROUTES.login || pathname === ROUTES.register || pathname === ROUTES.welcome;

  if (authStatus === 'loading') {
    // Cold start: hold on the splash, so a signed-in user never sees the login form flash up.
    return onSplash || onAuthPages ? null : ROUTES.splash;
  }
  // Signed out: a first launch gets the welcome tour, later ones go straight to sign in.
  if (authStatus === 'unauthenticated') return onAuthPages ? null : introSeen ? ROUTES.login : ROUTES.welcome;

  // Authenticated from here on. The periods query is keyed on the signed-in
  // user, so it reloads on every sign-in - wait for that fresh result (not a
  // previous user's, or the signed-out empty list) before deciding between
  // onboarding and overview.
  if (periods.loading && (onSplash || onAuthPages || !periods.hasData)) return null;
  // A failed load is not "no periods": send them to Overview, whose own error
  // state offers a retry, rather than into first-run onboarding.
  if (periods.failed) return onSplash || onAuthPages ? ROUTES.overview : null;

  const list = periods.data ?? [];
  const hasPeriods = list.length > 0;

  if (onSplash || onAuthPages) return hasPeriods ? ROUTES.overview : ROUTES.onboarding;
  // Only a *finished* period pulls someone off onboarding. A first upload makes
  // the list non-empty the moment it is accepted, and redirecting then would
  // tear down the upload sheet before it opens the Analysing screen - which
  // takes them to Overview itself once the job completes.
  if (pathname === ROUTES.onboarding && list.some((p) => p.processingStatus === 'COMPLETED')) return ROUTES.overview;
  if (TAB_PATHS.includes(pathname) && !hasPeriods) return ROUTES.onboarding;
  return null;
}
