import type { ComponentType } from "react";

/** Full-width empty state inside a table body. */
export default function EmptyRow({
  colSpan,
  icon: Icon,
  title,
  hint,
}: {
  colSpan: number;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  title: string;
  hint?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="!py-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-2lg bg-background-secondary-default">
            <Icon className="size-5 text-foreground-icon-tertiary" aria-hidden />
          </span>
          <p className="text-body-medium text-text-primary">{title}</p>
          {hint && <p className="text-body-regular text-text-secondary">{hint}</p>}
        </div>
      </td>
    </tr>
  );
}
