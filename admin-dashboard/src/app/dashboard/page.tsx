import { requireAdminSession } from "@/lib/dal";
import { adminBackendJson } from "@/lib/backend";
import PageHeader from "@/components/PageHeader";

interface Overview {
  users: { total: number; active: number; admins: number };
  jobs_by_status: Record<string, number>;
  statements_by_status: Record<string, number>;
  latest_releases: Record<string, { version_name: string; version_code: number; uploaded_at: string }>;
}

export default async function OverviewPage() {
  const { accessToken } = await requireAdminSession();
  const overview = await adminBackendJson<Overview>(accessToken, "/admin/overview");

  return (
    <div>
      <PageHeader title="Overview" description="A snapshot of the system right now." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total users" value={overview.users.total} />
        <StatCard label="Active users" value={overview.users.active} />
        <StatCard label="Admins" value={overview.users.admins} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatusBreakdownCard title="Jobs by status" counts={overview.jobs_by_status} />
        <StatusBreakdownCard title="Statements by status" counts={overview.statements_by_status} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Latest releases</h2>
        {Object.keys(overview.latest_releases).length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No releases published yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Object.entries(overview.latest_releases).map(([platform, release]) => (
              <div
                key={platform}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{platform}</p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{release.version_name}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  build {release.version_code} · {new Date(release.uploaded_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value.toLocaleString()}</p>
    </div>
  );
}

function StatusBreakdownCard({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
      <dl className="mt-3 flex flex-col gap-2">
        {entries.map(([status, count]) => (
          <div key={status} className="flex items-center justify-between text-sm">
            <dt className="text-zinc-500 dark:text-zinc-400">{status}</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{count.toLocaleString()}</dd>
          </div>
        ))}
        {total === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing yet.</p>}
      </dl>
    </div>
  );
}
