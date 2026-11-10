import { RiRocket2Line } from "@remixicon/react";

import { requireAdminSession } from "@/lib/dal";
import { adminBackendJson } from "@/lib/backend";
import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import StatusBadge from "@/components/StatusBadge";
import EmptyRow from "@/components/EmptyRow";
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
      <PageHeader title="App releases" description="Every uploaded Android build. The newest one is what the in-app updater offers." />

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel title="History" className="order-2 2xl:order-1">
          <div className="overflow-x-auto">
            <table className="bui-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Notes</th>
                  <th className="!text-end">Size</th>
                  <th>SHA-256</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((r) => (
                  <tr key={r.id} className="hover:bg-background-secondary-hover">
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-body-medium text-text-primary">{r.version_name}</span>
                        {r.is_latest && <StatusBadge status="LATEST" />}
                      </div>
                      <p className="whitespace-nowrap text-body-2-regular text-text-tertiary capitalize">
                        {r.platform} · build {r.version_code}
                        {r.min_supported_version_code ? ` · min ${r.min_supported_version_code}` : ""}
                      </p>
                    </td>
                    <td className="max-w-xs truncate text-text-secondary" title={r.release_notes || undefined}>
                      {r.release_notes || "—"}
                    </td>
                    <td className="text-end whitespace-nowrap text-text-secondary tabular-nums">{formatBytes(r.size_bytes)}</td>
                    <td className="font-mono text-body-2-regular text-text-tertiary" title={r.sha256}>
                      {r.sha256.slice(0, 12)}…
                    </td>
                    <td className="whitespace-nowrap text-text-secondary">{new Date(r.uploaded_at).toLocaleString()}</td>
                  </tr>
                ))}
                {releases.length === 0 && <EmptyRow colSpan={5} icon={RiRocket2Line} title="No releases published yet" hint="Publish the first build with the form." />}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="order-1 2xl:order-2">
          <PublishReleaseForm />
        </div>
      </div>
    </div>
  );
}
