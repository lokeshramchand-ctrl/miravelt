import Link from "next/link";

export default function Pagination({
  page,
  totalPages,
  makeHref,
}: {
  page: number;
  totalPages: number;
  makeHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <PageLink href={makeHref(page - 1)} disabled={page <= 1}>
          Previous
        </PageLink>
        <PageLink href={makeHref(page + 1)} disabled={page >= totalPages}>
          Next
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const className =
    "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700 " +
    (disabled
      ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800");

  if (disabled) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
