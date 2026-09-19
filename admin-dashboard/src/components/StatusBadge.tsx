const STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  SUCCESS: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  RUNNING: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  PROCESSING: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  QUEUED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  PENDING: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  FAILED: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  DISABLED: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  ADMIN: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  USER: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  LATEST: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

const DEFAULT_STYLE = "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status] ?? DEFAULT_STYLE}`}>
      {status}
    </span>
  );
}
