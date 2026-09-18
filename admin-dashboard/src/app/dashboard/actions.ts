"use server";

import { redirect } from "next/navigation";

import { publicBackendFetch } from "@/lib/backend";
import { getSession } from "@/lib/session";

export async function logoutAction() {
  const session = await getSession();
  if (session.refreshToken) {
    await publicBackendFetch("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    }).catch(() => {
      // Best-effort revoke - the session cookie is destroyed regardless, so
      // the dashboard can't be used from this browser either way.
    });
  }
  session.destroy();
  redirect("/login");
}
