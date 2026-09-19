import { requireAdminSession } from "@/lib/dal";
import { adminBackendJson } from "@/lib/backend";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import StatusFilter from "@/components/StatusFilter";
import Pagination from "@/components/Pagination";

const JOB_STATUSES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"];

interface Job {
  id: string;
  user_id: string;
  job_type: string;
  resource_type: string;
  resource_id: string;
  status: string;
  stage: string | null;
  progress_percent: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface JobList {
  items: Job[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export default async function JobsPage(props: PageProps<"/dashboard/jobs">) {
  const searchParams = await props.searchParams;
  const page = Number(searchParams.page ?? "1") || 1;
  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;

  const { accessToken } = await requireAdminSession();
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set("status", status);
  const jobs = await adminBackendJson<JobList>(accessToken, `/admin/jobs?${query}`);

  const makeHref = (p: number) => {
    const q = new URLSearchParams({ page: String(p) });
    if (status) q.set("status", status);
    return `/dashboard/jobs?${q}`;
  };
  const makeStatusHref = (s?: string) => {
    const q = new URLSearchParams({ page: "1" });
    if (s) q.set("status", s);
    return `/dashboard/jobs?${q}`;
  };

  return (
    <div>
      <PageHeader title="Jobs" description={`${jobs.total} job${jobs.total === 1 ? "" : "s"} total.`} />

      <div className="mb-4">
        <StatusFilter current={status} options={JOB_STATUSES} makeHref={makeStatusHref} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-2 font-medium">Job</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Progress</th>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.items.map((job) => (
                <tr key={job.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-3">
                    <p className="text-zinc-900 dark:text-zinc-100">{job.job_type}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{job.stage ?? "—"}</p>
                    {job.error_message && <p className="text-xs text-red-600 dark:text-red-400">{job.error_message}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{job.progress_percent}%</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/dashboard/users/${job.user_id}`}
                      className="font-mono text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                    >
                      {job.user_id}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{new Date(job.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {jobs.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No jobs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={jobs.page} totalPages={jobs.total_pages} makeHref={makeHref} />
      </div>
    </div>
  );
}
