import Link from "next/link";

/** A user id, shortened for tables, linking to that user. Full id in the tooltip. */
export default function UserIdLink({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/users/${id}`}
      title={id}
      className="rounded-sm font-mono text-body-2-regular text-text-secondary outline-none hover:text-text-primary hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring"
    >
      {id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id}
    </Link>
  );
}
