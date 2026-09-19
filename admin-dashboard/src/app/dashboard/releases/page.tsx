import { requireAdminSession } from "@/lib/dal";
import { adminBackendJson } from "@/lib/backend";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import PublishReleaseForm from "./PublishReleaseForm";

interface Release {
  id: string;
  platform: string;
  version_code: number;
  version_name: string;
  release_notes: string;
  min_supported_version_code: number | null;
  sha256: string;
  size_bytes: number;
  is_latest: boolean;
  uploaded_at: string;
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export default async function ReleasesPage() {
  const { accessToken } = await requireAdminSession();
  const releases = await adminBackendJson<Release[]>(accessToken, "/admin/releases");

  return (
    <div>
      <PageHeader title="App releases" description="Every uploaded Android build." />

      <div className="mb-6">
        <PublishReleaseForm />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">Notes</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium">SHA-256</th>
                <th className="px-4 py-2 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.version_name}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">build {r.version_code}</span>
                      {r.is_latest && <StatusBadge status="LATEST" />}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.platform}</p>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-zinc-600 dark:text-zinc-400">{r.release_notes || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatBytes(r.size_bytes)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">{r.sha256.slice(0, 12)}…</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{new Date(r.uploaded_at).toLocaleString()}</td>
                </tr>
              ))}
              {releases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No releases published yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
