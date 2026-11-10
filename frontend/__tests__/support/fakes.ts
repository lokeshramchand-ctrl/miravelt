import { ApiClient } from '../../src/api/client';
import type { TokenStorage } from '../../src/api/tokenStorage';

/** In-memory token storage, so tests don't need the native keystore. */
export function memoryTokenStorage(): TokenStorage {
  let access: string | null = null;
  let refresh: string | null = null;
  return {
    async saveTokens(t) {
      access = t.accessToken;
      refresh = t.refreshToken;
    },
    readAccessToken: async () => access,
    readRefreshToken: async () => refresh,
    async clear() {
      access = null;
      refresh = null;
    },
    hasSession: async () => refresh != null,
  };
}

export interface FakeResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface RecordedRequest {
  method: string;
  path: string;
  search: string;
  headers: Record<string, string>;
  body: unknown;
}

/** A scripted fetch: responses are queued per `METHOD /path` and consumed in order. */
export class FakeFetch {
  readonly requests: RecordedRequest[] = [];
  private readonly queues = new Map<string, FakeResponse[]>();

  queue(method: string, path: string, response: FakeResponse): void {
    const key = `${method} ${path}`;
    this.queues.set(key, [...(this.queues.get(key) ?? []), response]);
  }

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? 'GET').toUpperCase();
    this.requests.push({
      method,
      path: url.pathname,
      search: url.search,
      headers: { ...(init?.headers as Record<string, string>) },
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    });
    const key = `${method} ${url.pathname}`;
    const next = this.queues.get(key)?.shift();
    if (!next) throw new Error(`FakeFetch: no response queued for ${key}`);
    const text = next.body === undefined ? '' : JSON.stringify(next.body);
    return new Response(text || null, { status: next.status, headers: next.headers });
  };
}

export function makeClient(opts: { tokens?: TokenStorage; onSessionExpired?: () => void } = {}) {
  const fake = new FakeFetch();
  const tokens = opts.tokens ?? memoryTokenStorage();
  const client = new ApiClient({
    getBaseUrl: () => 'https://test.invalid/',
    tokenStorage: tokens,
    onSessionExpired: opts.onSessionExpired ?? (() => {}),
    fetchImpl: fake.fetch,
  });
  return { fake, tokens, client };
}

/** The error a promise rejects with; fails the test if it resolves. */
export async function caught(promise: Promise<unknown>): Promise<any> {
  return promise.then(
    () => {
      throw new Error('expected the promise to reject');
    },
    (e: unknown) => e,
  );
}
