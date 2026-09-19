"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/dal";
import { adminBackendFetch, BackendError } from "@/lib/backend";

export interface ReleaseFormState {
  error?: string;
  success?: boolean;
}

export async function publishRelease(_prev: ReleaseFormState, formData: FormData): Promise<ReleaseFormState> {
  const { accessToken } = await requireAdminSession();

  const apk = formData.get("apk");
  if (!(apk instanceof File) || apk.size === 0) {
    return { error: "Choose an APK file to upload." };
  }

  try {
    // Forwarded as-is: adminBackendFetch/rawFetch only sets Content-Type for
    // a string body, so this FormData keeps its own multipart boundary
    // exactly like a browser-submitted upload (routers/app_updates.py's
    // POST /app/releases, which core/security.py::validate_admin_key gates
    // on top of the router's usual X-Velar-API-Key).
    await adminBackendFetch(accessToken, "/app/releases", { method: "POST", body: formData });
  } catch (e) {
    return { error: e instanceof BackendError ? (e.detail ?? "Failed to publish release.") : "Failed to publish release." };
  }

  revalidatePath("/dashboard/releases");
  revalidatePath("/dashboard");
  return { success: true };
}
