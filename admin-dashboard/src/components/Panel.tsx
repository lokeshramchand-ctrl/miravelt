import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/** BoardUI card surface: rounded-3xl, button-default hairline, primary surface. */
export default function Panel({
  title,
  description,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cx(
        "min-w-0 overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default shadow-card",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h2 className="text-headline-semibold text-text-primary">{title}</h2>}
            {description && <p className="mt-0.5 text-body-regular text-text-secondary">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
