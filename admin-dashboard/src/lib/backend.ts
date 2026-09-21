import "server-only";

/** All server-side calls to auvren-backend go through here. Nothing in this
 * file - the backend URL, AUVREN_API_KEY, AUVREN_ADMIN_KEY, or any access
 * token - ever reaches the browser: pages/actions call these functions on
 * the server and pass back only the JSON they need. */

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}. See admin-dashboard/.env.example.`);
  return value;
}

export class BackendError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(`Backend request failed with status ${status}`);
    this.name = "BackendError";
  }

  /** Best-effort human-readable detail, matching core/error_handlers.py's
   * {"detail": "..."} envelope. */
  get detail(): string | undefined {
    if (this.body && typeof this.body === "object" && "detail" in this.body) {
      const detail = (this.body as { detail: unknown }).detail;
      return typeof detail === "string" ? detail : undefined;
    }
    return undefined;
  }
}

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const backendUrl = requiredEnv("BACKEND_URL");
  const headers = new Headers(init.headers);
  headers.set("X-Auvren-API-Key", requiredEnv("AUVREN_API_KEY"));
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${backendUrl}${path}`, { ...init, headers, cache: "no-store" });
}

/** Unauthenticated-as-a-user calls: only login needs this. */
export async function publicBackendFetch(path: string, init?: RequestInit): Promise<Response> {
  return rawFetch(path, init);
}

/** Admin-scoped calls: attaches the admin key and the caller's bearer token.
 * Throws BackendError on any non-2xx response - callers that want to handle
 * a specific status (e.g. 401 to redirect to /login) should catch it. */
export async function adminBackendFetch(accessToken: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("X-Auvren-Admin-Key", requiredEnv("AUVREN_ADMIN_KEY"));
  const res = await rawFetch(path, { ...init, headers });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON error body (rare - most of this app's errors go through
      // core/error_handlers.py's JSON envelope) - leave body null.
    }
    throw new BackendError(res.status, body);
  }

  return res;
}

export async function adminBackendJson<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const res = await adminBackendFetch(accessToken, path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
