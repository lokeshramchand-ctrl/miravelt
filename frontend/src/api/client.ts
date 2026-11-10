import { appConfig } from '../config/appConfig';
import {
  ApiCancelledException,
  ApiNetworkException,
  TIMEOUT_MESSAGE,
  UNREACHABLE_MESSAGE,
  apiExceptionFromResponse,
} from './errors';
import type { ApiException } from './errors';
import type { TokenStorage } from './tokenStorage';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  /** Overrides the default 20s receive timeout. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface UploadOptions {
  /** Text fields sent alongside the file. */
  fields?: Record<string, string>;
  file: { uri: string; name: string; type: string };
  fileField?: string;
  onProgress?: (sent: number, total: number) => void;
  signal?: AbortSignal;
}

export interface ApiClientDeps {
  /** Read on every request, so switching backends needs no client rebuild. */
  getBaseUrl: () => string;
  tokenStorage: TokenStorage;
  onSessionExpired: () => void;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 20_000;
// The backend reads and validates the whole PDF before it answers 202, and was
// measured taking ~30s on a 6-month statement - well past the default, which
// failed uploads that had succeeded.
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Thin wrapper around fetch. Attaches `X-Miravelt-API-Key` to every request
 * and `Authorization: Bearer` once a session exists. On a 401, attempts exactly
 * one token refresh (single-flight - concurrent 401s share the same refresh
 * call) and retries the original request; if refresh itself fails, clears the
 * session and calls `onSessionExpired` so the app can drop back to login.
 *
 * Every failure surfaces as a typed ApiException (errors.ts) so UI code never
 * touches fetch/XHR details.
 */
export class ApiClient {
  private refreshInFlight: Promise<boolean> | null = null;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly deps: ApiClientDeps) {
    this.fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args));
  }

  get baseUrl(): string {
    return this.deps.getBaseUrl();
  }

  get<T>(path: string, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }
  post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, options);
  }
  patch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', path, options);
  }
  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  private url(path: string, query?: QueryParams): string {
    const base = this.baseUrl.replace(/\/+$/, '');
    const qs = query
      ? Object.entries(query)
          .filter(([, v]) => v != null)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return `${base}${path.startsWith('/') ? path : `/${path}`}${qs ? `?${qs}` : ''}`;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'X-Miravelt-API-Key': appConfig.apiKey };
    const accessToken = await this.deps.tokenStorage.readAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return headers;
  }

  private async request<T>(method: string, path: string, options: RequestOptions): Promise<T> {
    const send = async (): Promise<Response> => {
      const headers = await this.authHeaders();
      if (options.body !== undefined) headers['Content-Type'] = 'application/json';
      return this.fetchWithTimeout(
        this.url(path, options.query),
        {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        },
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        options.signal,
      );
    };

    let response = await send();
    if (this.shouldRefresh(response.status, path)) {
      if (!(await this.refreshTokens())) return this.sessionExpired(response);
      response = await send();
    }
    return this.parse<T>(response);
  }

  /** Multipart upload via XHR - fetch exposes no upload progress, which the upload sheet needs. */
  async upload<T>(path: string, opts: UploadOptions): Promise<T> {
    const send = async (): Promise<{ status: number; data: unknown; retryAfter: string | null }> => {
      const headers = await this.authHeaders();
      return this.xhrUpload(this.url(path), headers, opts);
    };

    let result = await send();
    if (this.shouldRefresh(result.status, path)) {
      if (!(await this.refreshTokens())) {
        await this.deps.tokenStorage.clear();
        this.deps.onSessionExpired();
        throw apiExceptionFromResponse(result.status, result.data, result.retryAfter);
      }
      result = await send();
    }
    if (result.status >= 200 && result.status < 300) return result.data as T;
    throw apiExceptionFromResponse(result.status, result.data, result.retryAfter);
  }

  private xhrUpload(
    url: string,
    headers: Record<string, string>,
    opts: UploadOptions,
  ): Promise<{ status: number; data: unknown; retryAfter: string | null }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      xhr.responseType = 'text';

      const form = new FormData();
      for (const [k, v] of Object.entries(opts.fields ?? {})) form.append(k, v);
      // React Native's FormData takes a { uri, name, type } descriptor for files.
      form.append(opts.fileField ?? 'file', opts.file as unknown as Blob);

      if (opts.onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) opts.onProgress?.(e.loaded, e.total);
        };
      }
      xhr.onload = () => {
        let data: unknown;
        try {
          data = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
        } catch {
          data = undefined;
        }
        resolve({ status: xhr.status, data, retryAfter: xhr.getResponseHeader('Retry-After') });
      };
      xhr.onerror = () => reject(new ApiNetworkException(UNREACHABLE_MESSAGE));
      xhr.ontimeout = () => reject(new ApiNetworkException(TIMEOUT_MESSAGE));
      xhr.onabort = () => reject(new ApiCancelledException());

      if (opts.signal) {
        if (opts.signal.aborted) {
          reject(new ApiCancelledException());
          return;
        }
        opts.signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }
      xhr.send(form);
    });
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    external?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onExternalAbort = () => controller.abort();
    external?.addEventListener('abort', onExternalAbort, { once: true });
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch (e) {
      if (timedOut) throw new ApiNetworkException(TIMEOUT_MESSAGE);
      if (external?.aborted) throw new ApiCancelledException();
      throw new ApiNetworkException(e instanceof Error && e.message && !/network request failed/i.test(e.message) ? e.message : UNREACHABLE_MESSAGE);
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);
    }
  }

  /** Auth endpoints report their own 401s (bad password...) - those must not trigger a refresh. */
  private shouldRefresh(status: number, path: string): boolean {
    return status === 401 && !path.startsWith('/auth/');
  }

  private async sessionExpired(response: Response): Promise<never> {
    await this.deps.tokenStorage.clear();
    this.deps.onSessionExpired();
    throw await this.toException(response);
  }

  private async toException(response: Response): Promise<ApiException> {
    return apiExceptionFromResponse(response.status, await readJson(response), response.headers.get('Retry-After'));
  }

  private async parse<T>(response: Response): Promise<T> {
    if (response.ok) return (await readJson(response)) as T;
    throw await this.toException(response);
  }

  /**
   * Single-flight refresh: if a refresh is already underway, every caller
   * awaits the same result instead of racing the rotating refresh token (the
   * backend revokes it after first use).
   */
  private refreshTokens(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const attempt = this.doRefresh()
      .catch(() => false)
      .finally(() => {
        this.refreshInFlight = null;
      });
    this.refreshInFlight = attempt;
    return attempt;
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = await this.deps.tokenStorage.readRefreshToken();
    if (!refreshToken) return false;
    try {
      const response = await this.fetchWithTimeout(
        this.url('/auth/refresh'),
        {
          method: 'POST',
          headers: { 'X-Miravelt-API-Key': appConfig.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
        DEFAULT_TIMEOUT_MS,
      );
      if (!response.ok) return false;
      const data = (await readJson(response)) as { access_token: string; refresh_token: string };
      await this.deps.tokenStorage.saveTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
      return true;
    } catch {
      return false;
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
