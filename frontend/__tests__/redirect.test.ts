import type { Statement } from '../src/domain/types';
import { computeRedirect } from '../src/lib/redirect';
import type { RedirectInput } from '../src/lib/redirect';

const statement = (status: Statement['processingStatus']): Statement => ({ processingStatus: status }) as Statement;
const settled = (data: Statement[]): RedirectInput['periods'] => ({ loading: false, hasData: true, failed: false, data });
const loading: RedirectInput['periods'] = { loading: true, hasData: false, failed: false, data: undefined };

describe('computeRedirect', () => {
  it('holds on the splash during the cold-start session check', () => {
    expect(computeRedirect({ pathname: '/', authStatus: 'loading', periods: loading })).toBeNull();
    expect(computeRedirect({ pathname: '/overview', authStatus: 'loading', periods: loading })).toBe('/');
  });

  it('keeps a form sign-in on the login screen while the session check is pending', () => {
    expect(computeRedirect({ pathname: '/login', authStatus: 'loading', periods: loading })).toBeNull();
  });

  it('sends signed-out users to login, but lets them reach register', () => {
    expect(computeRedirect({ pathname: '/', authStatus: 'unauthenticated', periods: settled([]) })).toBe('/login');
    expect(computeRedirect({ pathname: '/overview', authStatus: 'unauthenticated', periods: settled([]) })).toBe('/login');
    expect(computeRedirect({ pathname: '/register', authStatus: 'unauthenticated', periods: settled([]) })).toBeNull();
    expect(computeRedirect({ pathname: '/login', authStatus: 'unauthenticated', periods: settled([]) })).toBeNull();
  });

  it('waits for the periods to load before choosing overview vs onboarding', () => {
    expect(computeRedirect({ pathname: '/login', authStatus: 'authenticated', periods: loading })).toBeNull();
    expect(computeRedirect({ pathname: '/', authStatus: 'authenticated', periods: loading })).toBeNull();
  });

  it('routes a signed-in user to overview, or onboarding when they have no periods', () => {
    expect(computeRedirect({ pathname: '/', authStatus: 'authenticated', periods: settled([statement('COMPLETED')]) })).toBe('/overview');
    expect(computeRedirect({ pathname: '/login', authStatus: 'authenticated', periods: settled([]) })).toBe('/onboarding');
  });

  it('does not treat a failed load as "no periods"', () => {
    const failed = { loading: false, hasData: false, failed: true, data: undefined };
    expect(computeRedirect({ pathname: '/', authStatus: 'authenticated', periods: failed })).toBe('/overview');
    expect(computeRedirect({ pathname: '/overview', authStatus: 'authenticated', periods: failed })).toBeNull();
  });

  it('only a finished period pulls someone off onboarding', () => {
    const analysing = settled([statement('PROCESSING')]);
    expect(computeRedirect({ pathname: '/onboarding', authStatus: 'authenticated', periods: analysing })).toBeNull();
    expect(computeRedirect({ pathname: '/onboarding', authStatus: 'authenticated', periods: settled([statement('COMPLETED')]) })).toBe('/overview');
  });

  it('keeps a refresh from bouncing the user while cached periods are on screen', () => {
    const refreshing = { loading: true, hasData: true, failed: false, data: [statement('COMPLETED')] };
    expect(computeRedirect({ pathname: '/signals', authStatus: 'authenticated', periods: refreshing })).toBeNull();
  });

  it('sends the tabs back to onboarding when the user has no periods', () => {
    for (const tab of ['/overview', '/signals', '/activity']) {
      expect(computeRedirect({ pathname: tab, authStatus: 'authenticated', periods: settled([]) })).toBe('/onboarding');
    }
    expect(computeRedirect({ pathname: '/profile', authStatus: 'authenticated', periods: settled([]) })).toBeNull();
  });

describe('welcome tour', () => {
  const settledEmpty = { loading: false, hasData: true, failed: false, data: [] };
  it('sends a first-time signed-out launch to the tour, later ones to sign in', () => {
    expect(computeRedirect({ pathname: '/', authStatus: 'unauthenticated', periods: settledEmpty, introSeen: false })).toBe('/welcome');
    expect(computeRedirect({ pathname: '/', authStatus: 'unauthenticated', periods: settledEmpty, introSeen: true })).toBe('/login');
  });
  it('lets a signed-out user stay on the tour, sign in or register', () => {
    for (const pathname of ['/welcome', '/login', '/register']) {
      expect(computeRedirect({ pathname, authStatus: 'unauthenticated', periods: settledEmpty, introSeen: false })).toBeNull();
    }
  });
  it('moves a signed-in user off the tour', () => {
    expect(computeRedirect({ pathname: '/welcome', authStatus: 'authenticated', periods: settledEmpty })).toBe('/onboarding');
  });
});
});
