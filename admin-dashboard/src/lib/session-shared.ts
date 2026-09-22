import { sealData, unsealData, type SessionOptions } from "iron-session";

/** Everything persisted in the session cookie. Deliberately minimal - the
 * FastAPI backend (miravelt-backend) stays the sole authority on identity and
 * scope; this is just enough to attach to outgoing backend requests and
 * decide when to refresh. */
export interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  /** Epoch ms. Recomputed from the backend's `expires_in` on every login/refresh. */
  accessTokenExpiresAt?: number;
  user?: { id: string; email: string };
}

export const SESSION_COOKIE_NAME = "miravelt_admin_session";

function sessionPassword(): string {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters " +
        "(generate one with: openssl rand -hex 32). See admin-dashboard/.env.example."
    );
  }
  return password;
}

/** A fresh options object per call (not a shared constant) since the
 * password is validated lazily - importing this module must never throw
 * just because SESSION_SECRET happens to be unset in some unrelated script. */
export function getSessionOptions(): SessionOptions {
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: sessionPassword(),
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

/** Used by src/proxy.ts to seal/unseal the cookie value directly, so it can
 * update both the outgoing response *and* the current request's cookie jar
 * in the same pass - see the "Using Cookies" example in Next's proxy.js docs. */
export async function sealSession(data: SessionData): Promise<string> {
  return sealData(data, { password: sessionPassword() });
}

export async function unsealSession(value: string): Promise<SessionData> {
  try {
    return await unsealData<SessionData>(value, { password: sessionPassword() });
  } catch {
    // Tampered, expired, or signed with a since-rotated SESSION_SECRET -
    // treat exactly like "no session" rather than throwing.
    return {};
  }
}
