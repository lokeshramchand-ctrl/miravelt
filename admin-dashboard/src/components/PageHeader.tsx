import type { ReactNode } from "react";

export default function PageHeader({
  title,
  description,
  right,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-title-1-medium text-text-primary">{title}</h1>
        {description && <p className="mt-1 text-body-regular text-text-secondary">{description}</p>}
      </div>
      {right}
    </div>
  );
}
