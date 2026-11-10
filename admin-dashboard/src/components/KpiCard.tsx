import type { ComponentType, ReactNode } from "react";

import { Chip, type ChipColor } from "@/components/base/badges/chip";

/**
 * BoardUI's plain stat card (icon tile, label, value) without the delta chip:
 * /admin/overview returns point-in-time counts, not period-over-period changes,
 * so the optional chip carries real context (a share, a sample) instead.
 */
export default function KpiCard({
  icon: Icon,
  label,
  value,
  note,
  noteColor = "neutral",
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  noteColor?: ChipColor;
}) {
  return (
    <section className="flex h-[132px] min-w-0 flex-col items-start justify-between rounded-2xl bg-background-secondary-default p-4">
      <span className="flex items-center rounded-md bg-stat-card-icon-background p-1.5">
        <Icon className="size-5 shrink-0 text-foreground-icon-primary" aria-hidden />
      </span>
      <div className="flex w-full flex-col gap-0.5">
        <p className="w-full truncate text-body-medium text-text-secondary">{label}</p>
        <div className="flex w-full flex-wrap items-center gap-2">
          <p className="text-title-1-medium whitespace-nowrap text-text-primary tabular-nums">{value}</p>
          {note != null && (
            <Chip variant="bold" color={noteColor}>
              {note}
            </Chip>
          )}
        </div>
      </div>
    </section>
  );
}
