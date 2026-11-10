import { ApiHttpException } from '../src/api/errors';
import { createAuthRepository } from '../src/api/repositories';
import { caught, makeClient } from './support/fakes';

const userJson = { id: 'user_123', email: 'test@miravelt.dev', is_active: true, created_at: '2026-08-13T00:00:00Z' };
const tokenResponse = (suffix: string) => ({
  status: 200,
  body: { access_token: `access-${suffix}`, refresh_token: `refresh-${suffix}`, token_type: 'bearer', expires_in: 900 },
});

function setup() {
  const ctx = makeClient();
  return { ...ctx, repo: createAuthRepository(ctx.client, ctx.tokens) };
}

describe('login', () => {
  it('saves tokens and returns the user on success', async () => {
    const { fake, tokens, repo } = setup();
    fake.queue('POST', '/auth/login', tokenResponse('1'));
    fake.queue('GET', '/users/me', { status: 200, body: userJson });

    const user = await repo.login('test@miravelt.dev', 'TestPass123!');

    expect(user.id).toBe('user_123');
    expect(user.fullName).toBeNull();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(await tokens.readAccessToken()).toBe('access-1');
    expect(await tokens.readRefreshToken()).toBe('refresh-1');
    // The login call carries the API key but no bearer token yet.
    expect(fake.requests[0].headers['X-Miravelt-API-Key']).toBeTruthy();
    expect(fake.requests[0].headers.Authorization).toBeUndefined();
    expect(fake.requests[1].headers.Authorization).toBe('Bearer access-1');
  });

  it('persists tokens even when the follow-up /users/me 404s', async () => {
    const { fake, tokens, repo } = setup();
    fake.queue('POST', '/auth/login', tokenResponse('2'));
    fake.queue('GET', '/users/me', { status: 404, body: { error: { detail: 'Not Found', request_id: 'req-1' } } });

    await expect(repo.login('test@miravelt.dev', 'TestPass123!')).rejects.toMatchObject({ statusCode: 404 });
    // login() only fails on the fetchCurrentUser() step *after* saving the tokens.
    expect(await tokens.hasSession()).toBe(true);
  });

  it('surfaces a bad-password 401 without trying to refresh', async () => {
    const { fake, repo } = setup();
    fake.queue('POST', '/auth/login', { status: 401, body: { error: { detail: 'Incorrect email or password' } } });
    const error = await caught(repo.login('a@b.co', 'nope'));
    expect(error).toBeInstanceOf(ApiHttpException);
    expect(error.message).toBe('Incorrect email or password');
    expect(fake.requests).toHaveLength(1);
  });
});

describe('register', () => {
  it('creates the account, then a separate login signs it in', async () => {
    const { fake, tokens, repo } = setup();
    fake.queue('POST', '/auth/register', { status: 201, body: userJson });
    fake.queue('POST', '/auth/login', tokenResponse('3'));
    fake.queue('GET', '/users/me', { status: 200, body: userJson });

    const registered = await repo.register('test@miravelt.dev', 'TestPass123!');
    const loggedIn = await repo.login('test@miravelt.dev', 'TestPass123!');

    expect(registered.email).toBe('test@miravelt.dev');
    expect(loggedIn.email).toBe('test@miravelt.dev');
    expect(await tokens.hasSession()).toBe(true);
  });
});

describe('logout', () => {
  it('clears the local session on a successful server call', async () => {
    const { fake, tokens, repo } = setup();
    await tokens.saveTokens({ accessToken: 'a', refreshToken: 'r' });
    fake.queue('POST', '/auth/logout', { status: 204 });
    await repo.logout();
    expect(await tokens.hasSession()).toBe(false);
  });

  it('still clears the local session when the server call fails', async () => {
    const { fake, tokens, repo } = setup();
    await tokens.saveTokens({ accessToken: 'a', refreshToken: 'r' });
    fake.queue('POST', '/auth/logout', { status: 500, body: { error: { detail: 'Internal Server Error' } } });
    await repo.logout();
    expect(await tokens.hasSession()).toBe(false);
  });

  it('does not call the server when there is no session to end', async () => {
    const { fake, repo } = setup();
    await repo.logout();
    expect(fake.requests).toHaveLength(0);
  });
});
