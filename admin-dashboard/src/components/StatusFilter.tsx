import Link from "next/link";

export default function StatusFilter({
  current,
  options,
  makeHref,
}: {
  current?: string;
  options: string[];
  makeHref: (status?: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterLink href={makeHref(undefined)} active={!current}>
        All
      </FilterLink>
      {options.map((opt) => (
        <FilterLink key={opt} href={makeHref(opt)} active={current === opt}>
          {opt}
        </FilterLink>
      ))}
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
    >
      {children}
    </Link>
  );
}
