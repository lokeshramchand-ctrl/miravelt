import { Chip, type ChipColor } from "@/components/base/badges/chip";

const COLORS: Record<string, ChipColor> = {
  COMPLETED: "lime",
  SUCCESS: "lime",
  ACTIVE: "lime",
  RUNNING: "blue",
  PROCESSING: "blue",
  LATEST: "blue",
  QUEUED: "neutral",
  PENDING: "neutral",
  USER: "neutral",
  FAILED: "rose",
  DISABLED: "rose",
  ADMIN: "purple",
};

/** Status chip colour for a backend status string; unknown statuses stay neutral. */
export function statusColor(status: string): ChipColor {
  return COLORS[status] ?? "neutral";
}

/** "PROCESSING" -> "Processing" (backend statuses are upper-case enums). */
export function statusLabel(status: string): string {
  const lower = status.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Chip variant="caption" color={statusColor(status)}>
      {statusLabel(status)}
    </Chip>
  );
}
