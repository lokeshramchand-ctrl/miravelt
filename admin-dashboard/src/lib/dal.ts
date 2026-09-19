import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { getSession } from "./session";

/** Data Access Layer entry point - call this at the top of every dashboard
 * Server Component/Server Action instead of reading the session cookie
 * directly. src/proxy.ts already redirects unauthenticated/expired sessions
 * before they reach here, but this is the real enforcement point (proxy is
 * an optimistic pre-filter, not a substitute for per-request checks - see
 * Next's authentication guide). Wrapped in React's cache() so multiple
 * calls within one render pass share a single session read. */
export const requireAdminSession = cache(async () => {
  const session = await getSession();

  if (!session.accessToken || !session.refreshToken || !session.user) {
    redirect("/login");
  }

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: session.user,
  };
});
