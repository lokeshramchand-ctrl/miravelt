import { RiStackLine } from "@remixicon/react";

import { requireAdminSession } from "@/lib/dal";
import { adminBackendJson } from "@/lib/backend";
import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import StatusBadge from "@/components/StatusBadge";
import StatusFilter from "@/components/StatusFilter";
import Pagination from "@/components/Pagination";
import EmptyRow from "@/components/EmptyRow";
import UserIdLink from "@/components/UserIdLink";
import { cx } from "@/utils/cx";

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

  return (
    <div>
      <PageHeader
        title="Jobs"
        description={`${jobs.total.toLocaleString()} job${jobs.total === 1 ? "" : "s"}${status ? " with this status" : " total"}.`}
        right={<StatusFilter current={status} options={JOB_STATUSES} basePath="/dashboard/jobs" />}
      />

      <Panel>
        <div className="overflow-x-auto">
          <table className="bui-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Progress</th>
                <th>User</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.items.map((job) => (
                <tr key={job.id} className="hover:bg-background-secondary-hover">
                  <td>
                    <p className="text-body-medium text-text-primary">{job.job_type}</p>
                    <p className="text-body-2-regular text-text-tertiary">{job.stage ?? "—"}</p>
                    {job.error_message && <p className="mt-0.5 max-w-md text-body-2-regular text-text-error-primary">{job.error_message}</p>}
                  </td>
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td>
                    <ProgressMeter percent={job.progress_percent} failed={job.status === "FAILED"} />
                  </td>
                  <td>
                    <UserIdLink id={job.user_id} />
                  </td>
                  <td className="whitespace-nowrap text-text-secondary">{new Date(job.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {jobs.items.length === 0 && <EmptyRow colSpan={5} icon={RiStackLine} title="No jobs found" hint={status ? "Try another status filter." : undefined} />}
            </tbody>
          </table>
        </div>
        <Pagination page={jobs.page} totalPages={jobs.total_pages} basePath="/dashboard/jobs" params={{ status }} />
      </Panel>
    </div>
  );
}

function ProgressMeter({ percent, failed }: { percent: number; failed: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} aria-label="Progress">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-background-tertiary-default">
        <span
          className={cx("block h-full rounded-full", failed ? "bg-status-rose-text" : clamped >= 100 ? "bg-status-lime-text" : "bg-accent-500")}
          style={{ width: `${clamped}%` }}
        />
      </span>
      <span className="w-9 text-body-2-medium text-text-secondary tabular-nums">{clamped}%</span>
    </div>
  );
}
