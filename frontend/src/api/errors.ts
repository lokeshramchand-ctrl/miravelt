/**
 * Typed errors mirroring docs/API_REFERENCE.md §0.
 *
 * Three response shapes exist on the wire:
 *  - the standard envelope: `{"error": {"detail", "request_id", "errors"?}}`
 *  - the body-size-limit fast path: `{"error": "payload_too_large", "detail": "..."}`
 *  - the rate-limit shape: `{"error": "Rate limit exceeded: ..."}`
 */
export class ApiException extends Error {
  constructor(
    public readonly statusCode: number | null,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ApiValidationError {
  loc: string[];
  msg: string;
  type: string;
}

/** A structured error from the standard envelope (401/403/404/409/422/500...). */
export class ApiHttpException extends ApiException {
  constructor(
    statusCode: number,
    detail: string,
    public readonly requestId?: string,
    public readonly validationErrors?: ApiValidationError[],
  ) {
    super(statusCode, detail);
  }
}

/** 413 fast-path: `Content-Length` exceeded `MAX_REQUEST_BODY_BYTES` before the body was read. */
export class ApiPayloadTooLargeException extends ApiException {
  constructor(message: string) {
    super(413, message);
  }
}

/** 429: `core/rate_limiter.py` (slowapi default handler). */
export class ApiRateLimitException extends ApiException {
  constructor(
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(429, message);
  }
}

/** No response reached the server at all (offline, timeout, DNS, TLS...). */
export class ApiNetworkException extends ApiException {
  constructor(message: string) {
    super(null, message);
  }
}

/**
 * Refresh token was invalid, expired, or reused (theft response - the backend
 * revokes ALL sessions server-side on reuse). Callers must force a full
 * re-login, not retry.
 */
export class ApiSessionExpiredException extends ApiException {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(401, message);
  }
}

export class ApiCancelledException extends ApiException {
  constructor() {
    super(null, 'Cancelled.');
  }
}

export const TIMEOUT_MESSAGE = 'The request timed out. Check your connection and try again.';
export const UNREACHABLE_MESSAGE = "Couldn't reach Miravelt. Check your connection and try again.";

/** Maps a non-2xx response (already parsed as JSON where possible) to the right typed exception. */
export function apiExceptionFromResponse(status: number, data: unknown, retryAfter: string | null): ApiException {
  const body = isRecord(data) ? data : undefined;

  if (status === 413) {
    const detail = body?.detail != null ? String(body.detail) : undefined;
    return new ApiPayloadTooLargeException(detail ?? 'This file is too large.');
  }

  if (status === 429) {
    const rawError = body?.error != null ? String(body.error) : undefined;
    const parsed = retryAfter == null ? NaN : parseInt(retryAfter, 10);
    return new ApiRateLimitException(
      rawError ?? "You're doing that too often. Try again shortly.",
      Number.isNaN(parsed) ? undefined : parsed,
    );
  }

  if (body && isRecord(body.error)) {
    const envelope = body.error;
    const rawErrors = envelope.errors;
    return new ApiHttpException(
      status,
      envelope.detail != null ? String(envelope.detail) : 'Something went wrong.',
      envelope.request_id != null ? String(envelope.request_id) : undefined,
      Array.isArray(rawErrors)
        ? rawErrors.filter(isRecord).map((e) => ({
            loc: Array.isArray(e.loc) ? e.loc.map(String) : [],
            msg: e.msg != null ? String(e.msg) : '',
            type: e.type != null ? String(e.type) : '',
          }))
        : undefined,
    );
  }

  return new ApiHttpException(status, `Something went wrong. (HTTP ${status})`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
