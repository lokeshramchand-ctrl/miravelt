import { requireAdminSession } from "@/lib/dal";
import { adminBackendJson } from "@/lib/backend";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import StatusFilter from "@/components/StatusFilter";
import Pagination from "@/components/Pagination";

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

  const makeHref = (p: number) => {
    const q = new URLSearchParams({ page: String(p) });
    if (status) q.set("status", status);
    return `/dashboard/statements?${q}`;
  };
  const makeStatusHref = (s?: string) => {
    const q = new URLSearchParams({ page: "1" });
    if (s) q.set("status", s);
    return `/dashboard/statements?${q}`;
  };

  return (
    <div>
      <PageHeader title="Statements" description={`${statements.total} statement${statements.total === 1 ? "" : "s"} total.`} />

      <div className="mb-4">
        <StatusFilter current={status} options={STATEMENT_STATUSES} makeHref={makeStatusHref} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-2 font-medium">File</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-4 py-2 font-medium">Transactions</th>
                <th className="px-4 py-2 font-medium">Reconciled</th>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {statements.items.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-3">
                    <p className="text-zinc-900 dark:text-zinc-100">{s.original_filename}</p>
                    {s.error_message && <p className="text-xs text-red-600 dark:text-red-400">{s.error_message}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.processing_status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {s.period_start} – {s.period_end}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{s.transaction_count}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {s.reconciliation_ok === null ? "—" : s.reconciliation_ok ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/dashboard/users/${s.user_id}`}
                      className="font-mono text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                    >
                      {s.user_id}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{new Date(s.uploaded_at).toLocaleString()}</td>
                </tr>
              ))}
              {statements.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No statements found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={statements.page} totalPages={statements.total_pages} makeHref={makeHref} />
      </div>
    </div>
  );
}
