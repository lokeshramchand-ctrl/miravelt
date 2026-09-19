"use server";

import { redirect } from "next/navigation";

import { adminBackendFetch, publicBackendFetch } from "@/lib/backend";
import { getSession } from "@/lib/session";

export interface LoginState {
  error?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const loginRes = await publicBackendFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (loginRes.status === 401) return { error: "Invalid email or password." };
  if (loginRes.status === 403) return { error: "This account is disabled." };
  if (loginRes.status === 429) return { error: "Too many attempts. Please wait a moment and try again." };
  if (!loginRes.ok) return { error: "Login failed. Please try again." };

  const tokens = (await loginRes.json()) as TokenResponse;

  // The login response alone doesn't tell us this account has admin scope -
  // routers/auth.py issues that as a JWT claim, so the only way to confirm
  // it is to actually call an admin-scope-gated route (core.jwt_auth
  // .require_scope("admin") on the backend is the sole authority here, not
  // anything decoded client-side).
  let me: { id: string; email: string } | null = null;
  try {
    const [overviewRes, meRes] = await Promise.all([
      adminBackendFetch(tokens.access_token, "/admin/overview"),
      adminBackendFetch(tokens.access_token, "/users/me"),
    ]);
    me = (await meRes.json()) as { id: string; email: string };
    void overviewRes;
  } catch {
    // Not an admin (403), or the admin key on this dashboard doesn't match
    // the backend's ADMIN_API_KEY (403/503) - don't leave a live session
    // token lying around for an account that can't use it.
    await publicBackendFetch("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    }).catch(() => {});
    return { error: "This account does not have admin access." };
  }

  if (!me) return { error: "Login failed. Please try again." };

  const session = await getSession();
  session.accessToken = tokens.access_token;
  session.refreshToken = tokens.refresh_token;
  session.accessTokenExpiresAt = Date.now() + tokens.expires_in * 1000;
  session.user = { id: me.id, email: me.email };
  await session.save();

  redirect(next.startsWith("/dashboard") ? next : "/dashboard");
}
