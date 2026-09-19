"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/dal";
import { adminBackendFetch, BackendError } from "@/lib/backend";

export interface ActionResult {
  error?: string;
}

function errorResult(e: unknown, fallback: string): ActionResult {
  return { error: e instanceof BackendError ? (e.detail ?? fallback) : fallback };
}

/** Every action here re-checks the session and lets the backend re-enforce
 * admin scope on every call (routers/admin.py) - the page that renders the
 * button is already behind requireAdminSession, but Server Actions are
 * reachable independently of the page that rendered them and must be
 * treated as their own endpoint (see Next's authentication guide). */

export async function toggleUserActive(userId: string, nextActive: boolean): Promise<ActionResult> {
  const { accessToken } = await requireAdminSession();
  try {
    await adminBackendFetch(accessToken, `/admin/users/${userId}/active?active=${nextActive}`, { method: "PATCH" });
  } catch (e) {
    return errorResult(e, "Failed to update user.");
  }
  revalidatePath("/dashboard/users");
  revalidatePath(`/dashboard/users/${userId}`);
  return {};
}

export async function updateUserRole(userId: string, role: "user" | "admin"): Promise<ActionResult> {
  const { accessToken } = await requireAdminSession();
  try {
    await adminBackendFetch(accessToken, `/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  } catch (e) {
    return errorResult(e, "Failed to update role.");
  }
  revalidatePath("/dashboard/users");
  revalidatePath(`/dashboard/users/${userId}`);
  return {};
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const { accessToken } = await requireAdminSession();
  try {
    await adminBackendFetch(accessToken, `/admin/users/${userId}`, { method: "DELETE" });
  } catch (e) {
    return errorResult(e, "Failed to delete user.");
  }
  revalidatePath("/dashboard/users");
  revalidatePath(`/dashboard/users/${userId}`);
  return {};
}
