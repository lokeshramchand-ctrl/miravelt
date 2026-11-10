"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { statusLabel } from "@/components/StatusBadge";
import { cx } from "@/utils/cx";

const ALL = "__all";

/**
 * Status filter as a BoardUI segmented control. Filter state lives in the URL
 * (`?status=`), so selecting a segment navigates; the page re-renders server-side.
 */
export default function StatusFilter({
  current,
  options,
  basePath,
}: {
  current?: string;
  options: string[];
  basePath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="max-w-full overflow-x-auto [scrollbar-width:none]">
      <SegmentedControl
        aria-label="Filter by status"
        selectedKeys={[current ?? ALL]}
        onSelectionChange={(keys) => {
          const [key] = [...keys];
          const q = new URLSearchParams({ page: "1" });
          if (key && key !== ALL) q.set("status", String(key));
          startTransition(() => router.push(`${basePath}?${q}`));
        }}
        className={cx(pending && "opacity-70")}
      >
        <SegmentedControlItem id={ALL}>All</SegmentedControlItem>
        {options.map((opt) => (
          <SegmentedControlItem key={opt} id={opt}>
            {statusLabel(opt)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </div>
  );
}
