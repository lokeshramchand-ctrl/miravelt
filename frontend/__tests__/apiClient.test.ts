import { ApiHttpException, ApiNetworkException, ApiPayloadTooLargeException, ApiRateLimitException } from '../src/api/errors';
import { caught, makeClient } from './support/fakes';

describe('token refresh', () => {
  it('refreshes once on 401 and retries the original request with the new token', async () => {
    const { fake, tokens, client } = makeClient();
    await tokens.saveTokens({ accessToken: 'old', refreshToken: 'r1' });
    fake.queue('GET', '/statements', { status: 401, body: { error: { detail: 'expired' } } });
    fake.queue('POST', '/auth/refresh', { status: 200, body: { access_token: 'new', refresh_token: 'r2' } });
    fake.queue('GET', '/statements', { status: 200, body: { ok: true } });

    await expect(client.get('/statements')).resolves.toEqual({ ok: true });

    expect(fake.requests.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /statements', 'POST /auth/refresh', 'GET /statements']);
    expect(fake.requests[2].headers.Authorization).toBe('Bearer new');
    expect(await tokens.readRefreshToken()).toBe('r2');
  });

  it('shares one refresh between concurrent 401s (the refresh token is single-use)', async () => {
    const { fake, tokens, client } = makeClient();
    await tokens.saveTokens({ accessToken: 'old', refreshToken: 'r1' });
    fake.queue('GET', '/a', { status: 401 });
    fake.queue('GET', '/b', { status: 401 });
    fake.queue('POST', '/auth/refresh', { status: 200, body: { access_token: 'new', refresh_token: 'r2' } });
    fake.queue('GET', '/a', { status: 200, body: 'a' });
    fake.queue('GET', '/b', { status: 200, body: 'b' });

    await expect(Promise.all([client.get('/a'), client.get('/b')])).resolves.toEqual(['a', 'b']);
    expect(fake.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(1);
  });

  it('clears the session and signals expiry when the refresh fails', async () => {
    const onSessionExpired = jest.fn();
    const { fake, tokens, client } = makeClient({ onSessionExpired });
    await tokens.saveTokens({ accessToken: 'old', refreshToken: 'r1' });
    fake.queue('GET', '/statements', { status: 401, body: { error: { detail: 'expired' } } });
    fake.queue('POST', '/auth/refresh', { status: 401, body: { error: { detail: 'reused' } } });

    await expect(client.get('/statements')).rejects.toMatchObject({ statusCode: 401 });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(await tokens.hasSession()).toBe(false);
  });

  it('does not loop: a 401 on the retried request surfaces as an error', async () => {
    const { fake, tokens, client } = makeClient();
    await tokens.saveTokens({ accessToken: 'old', refreshToken: 'r1' });
    fake.queue('GET', '/x', { status: 401, body: { error: { detail: 'nope' } } });
    fake.queue('POST', '/auth/refresh', { status: 200, body: { access_token: 'n', refresh_token: 'r2' } });
    fake.queue('GET', '/x', { status: 401, body: { error: { detail: 'still nope' } } });

    await expect(client.get('/x')).rejects.toMatchObject({ message: 'still nope' });
    expect(fake.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(1);
  });
});

describe('offline is not signed out (F13)', () => {
  it('keeps the session when the refresh call itself cannot reach the server', async () => {
    const onSessionExpired = jest.fn();
    const { fake, tokens, client } = makeClient({ onSessionExpired });
    await tokens.saveTokens({ accessToken: 'old', refreshToken: 'r1' });
    fake.queue('GET', '/statements', { status: 401 });
    // No response queued for /auth/refresh: FakeFetch throws, like a dropped connection.
    await expect(client.get('/statements')).rejects.toBeInstanceOf(ApiNetworkException);
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(await tokens.readRefreshToken()).toBe('r1');
  });

  it('treats a 5xx from refresh as an outage, not a rejection', async () => {
    const onSessionExpired = jest.fn();
    const { fake, tokens, client } = makeClient({ onSessionExpired });
    await tokens.saveTokens({ accessToken: 'old', refreshToken: 'r1' });
    fake.queue('GET', '/statements', { status: 401 });
    fake.queue('POST', '/auth/refresh', { status: 502 });
    await expect(client.get('/statements')).rejects.toBeInstanceOf(ApiNetworkException);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});

describe('error codes', () => {
  it('carries the backend code and extra fields', async () => {
    const { fake, client } = makeClient();
    fake.queue('GET', '/x', {
      status: 409,
      body: { error: { detail: 'You already added this statement.', code: 'duplicate_statement', statement_id: 's9', request_id: 'r' } },
    });
    const e = (await caught(client.get('/x'))) as ApiHttpException;
    expect(e.code).toBe('duplicate_statement');
    expect(e.extra).toEqual({ statement_id: 's9' });
  });
});

describe('error mapping', () => {
  it('reads the standard envelope, request id and validation errors', async () => {
    const { fake, client } = makeClient();
    fake.queue('POST', '/auth/register', {
      status: 422,
      body: { error: { detail: 'Validation failed', request_id: 'req-9', errors: [{ loc: ['body', 'email'], msg: 'bad', type: 'value_error' }] } },
    });
    const e = await caught(client.post('/auth/register', { body: {} }));
    expect(e).toBeInstanceOf(ApiHttpException);
    expect(e).toMatchObject({ statusCode: 422, requestId: 'req-9', message: 'Validation failed' });
    expect(e.validationErrors).toEqual([{ loc: ['body', 'email'], msg: 'bad', type: 'value_error' }]);
  });

  it('maps 413 and 429 fast-path shapes', async () => {
    const { fake, client } = makeClient();
    fake.queue('GET', '/big', { status: 413, body: { error: 'payload_too_large', detail: 'Too big.' } });
    fake.queue('GET', '/fast', { status: 429, body: { error: 'Rate limit exceeded: 5 per 1 minute' }, headers: { 'Retry-After': '30' } });
    const big = await caught(client.get('/big'));
    const fast = await caught(client.get('/fast'));
    expect(big).toBeInstanceOf(ApiPayloadTooLargeException);
    expect(big.message).toBe('Too big.');
    expect(fast).toBeInstanceOf(ApiRateLimitException);
    expect(fast.retryAfterSeconds).toBe(30);
  });

  it('falls back to a generic message for an unrecognised body', async () => {
    const { fake, client } = makeClient();
    fake.queue('GET', '/boom', { status: 502 });
    const e = await caught(client.get('/boom'));
    expect(e.message).toBe('Something went wrong. (HTTP 502)');
  });

  it('reports an unreachable server as a network error', async () => {
    const { client } = makeClient();
    // No response queued: the fake throws, like a refused connection.
    const e = await caught(client.get('/nothing'));
    expect(e).toBeInstanceOf(ApiNetworkException);
  });
});

describe('query strings', () => {
  it('drops null/undefined params and encodes the rest', async () => {
    const { fake, client } = makeClient();
    fake.queue('GET', '/s', { status: 200, body: {} });
    await client.get('/s', { query: { page: 1, category: undefined, merchant: 'A & B' } });
    expect(fake.requests[0].search).toBe('?page=1&merchant=A%20%26%20B');
  });
});
