import { RiCheckboxCircleFill, RiCloseCircleFill, RiFilePdf2Line, RiFileList3Line } from "@remixicon/react";

import { requireAdminSession } from "@/lib/dal";
import { adminBackendJson } from "@/lib/backend";
import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import StatusBadge from "@/components/StatusBadge";
import StatusFilter from "@/components/StatusFilter";
import Pagination from "@/components/Pagination";
import EmptyRow from "@/components/EmptyRow";
import UserIdLink from "@/components/UserIdLink";

const STATEMENT_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"];

interface Statement {
  id: string;
  user_id: string;
  original_filename: string;
  file_size_bytes: number;
  period_start: string;
  period_end: string;
  transaction_count: number;
  processing_status: string;
  reconciliation_ok: boolean | null;
  error_message: string | null;
  uploaded_at: string;
  processing_completed_at: string | null;
}

interface StatementList {
  items: Statement[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export default async function StatementsPage(props: PageProps<"/dashboard/statements">) {
  const searchParams = await props.searchParams;
  const page = Number(searchParams.page ?? "1") || 1;
  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;

  const { accessToken } = await requireAdminSession();
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set("processing_status", status);
  const statements = await adminBackendJson<StatementList>(accessToken, `/admin/statements?${query}`);

  return (
    <div>
      <PageHeader
        title="Statements"
        description={`${statements.total.toLocaleString()} statement${statements.total === 1 ? "" : "s"}${status ? " with this status" : " total"}.`}
        right={<StatusFilter current={status} options={STATEMENT_STATUSES} basePath="/dashboard/statements" />}
      />

      <Panel>
        <div className="overflow-x-auto">
          <table className="bui-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Status</th>
                <th>Period</th>
                <th className="!text-end">Transactions</th>
                <th>Reconciled</th>
                <th>User</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {statements.items.map((s) => (
                <tr key={s.id} className="hover:bg-background-secondary-hover">
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary-default">
                        <RiFilePdf2Line className="size-4 text-foreground-icon-secondary" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="max-w-[16rem] truncate text-body-medium text-text-primary" title={s.original_filename}>
                          {s.original_filename}
                        </p>
                        <p className="text-body-2-regular text-text-tertiary">{formatBytes(s.file_size_bytes)}</p>
                      </div>
                    </div>
                    {s.error_message && <p className="mt-1 max-w-md text-body-2-regular text-text-error-primary">{s.error_message}</p>}
                  </td>
                  <td>
                    <StatusBadge status={s.processing_status} />
                  </td>
                  <td className="whitespace-nowrap text-text-secondary">
                    {s.period_start} – {s.period_end}
                  </td>
                  <td className="text-end tabular-nums">{s.transaction_count.toLocaleString()}</td>
                  <td>
                    <Reconciled ok={s.reconciliation_ok} />
                  </td>
                  <td>
                    <UserIdLink id={s.user_id} />
                  </td>
                  <td className="whitespace-nowrap text-text-secondary">{new Date(s.uploaded_at).toLocaleString()}</td>
                </tr>
              ))}
              {statements.items.length === 0 && (
                <EmptyRow colSpan={7} icon={RiFileList3Line} title="No statements found" hint={status ? "Try another status filter." : undefined} />
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={statements.page} totalPages={statements.total_pages} basePath="/dashboard/statements" params={{ status }} />
      </Panel>
    </div>
  );
}

function Reconciled({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-text-tertiary">—</span>;
  return ok ? (
    <span className="inline-flex items-center gap-1 text-status-lime-text">
      <RiCheckboxCircleFill className="size-4" aria-hidden /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-status-rose-text">
      <RiCloseCircleFill className="size-4" aria-hidden /> No
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
