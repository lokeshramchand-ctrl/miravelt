import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, sealSession, unsealSession, type SessionData } from "@/lib/session-shared";

/** Optimistic pre-filter for /dashboard/**: bounces missing/expired sessions
 * to /login before a page even starts rendering, and proactively refreshes
 * the access token so pages/actions downstream can just trust
 * session.accessToken is usable (src/lib/dal.ts still re-checks - this is
 * the fast path, not the only line of defense; see Next's authentication
 * guide on Proxy vs. the DAL). Runs on Node.js runtime by default in
 * Next 16, so the same session-shared.ts seal/unseal helpers work here as
 * anywhere else server-side. */
const REFRESH_MARGIN_MS = 30_000;

export default async function proxy(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const data: SessionData = raw ? await unsealSession(raw) : {};

  if (!data.accessToken || !data.refreshToken || !data.user) {
    return redirectToLogin(request);
  }

  const expiresInMs = (data.accessTokenExpiresAt ?? 0) - Date.now();
  if (expiresInMs >= REFRESH_MARGIN_MS) {
    return NextResponse.next();
  }

  const refreshed = await refreshTokens(data.refreshToken);
  if (!refreshed) {
    return redirectToLogin(request, /* clearCookie */ true);
  }

  const updated: SessionData = {
    ...data,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    accessTokenExpiresAt: Date.now() + refreshed.expires_in * 1000,
  };
  const sealed = await sealSession(updated);

  // Make the refreshed cookie visible both to this same request's
  // downstream rendering (request.cookies) and to the browser on its next
  // request (response.cookies) - see the proxy.js "Using Cookies" example.
  request.cookies.set(SESSION_COOKIE_NAME, sealed);
  const response = NextResponse.next({ request });
  response.cookies.set(SESSION_COOKIE_NAME, sealed, { httpOnly: true, sameSite: "lax", path: "/" });
  return response;
}

function redirectToLogin(request: NextRequest, clearCookie = false) {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", request.nextUrl.pathname);
  const response = NextResponse.redirect(url);
  if (clearCookie) response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

async function refreshTokens(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Velar-API-Key": process.env.VELAR_API_KEY ?? "",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
