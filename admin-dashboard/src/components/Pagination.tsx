"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Pagination as BoardPagination } from "@/components/base/pagination/pagination";
import { cx } from "@/utils/cx";

/** BoardUI pagination driven by the URL: `?page=` plus whatever other params the list keeps. */
export default function Pagination({
  page,
  totalPages,
  basePath,
  params = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (totalPages <= 1) return null;

  return (
    <div className={cx("border-t border-separator-border px-4 py-3", pending && "opacity-70")}>
      <BoardPagination
        page={page}
        totalPages={totalPages}
        onChange={(p) => {
          const q = new URLSearchParams({ page: String(p) });
          for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
          startTransition(() => router.push(`${basePath}?${q}`));
        }}
      />
    </div>
  );
}
