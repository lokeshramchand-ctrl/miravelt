"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  RiDashboardLine,
  RiFileList3Line,
  RiGroupLine,
  RiInstallLine,
  RiStackLine,
} from "@remixicon/react";

import { cx } from "@/utils/cx";

/** Icon keys rather than components: icons are functions and can't cross the server -> client boundary. */
const ICONS = {
  overview: RiDashboardLine,
  users: RiGroupLine,
  jobs: RiStackLine,
  statements: RiFileList3Line,
  releases: RiInstallLine,
};

export type NavIcon = keyof typeof ICONS;

/** BoardUI sidebar nav row: gradient accent pill when selected, soft hover otherwise. */
export default function NavLink({
  href,
  icon,
  children,
  compact = false,
}: {
  href: string;
  icon: NavIcon;
  children: React.ReactNode;
  /** Horizontal top-bar form for narrow screens. */
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  const Icon = ICONS[icon];

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex shrink-0 items-center gap-2 rounded-2lg p-2 outline-none transition-colors duration-200 ease",
        "focus-visible:ring-2 focus-visible:ring-border-focus-ring",
        compact ? "pe-3" : "w-full",
        active
          ? "bg-linear-to-b from-accent-500 to-accent-600 shadow-nav-selected"
          : "hover:bg-background-secondary-hover",
      )}
    >
      <Icon className={cx("size-5 shrink-0", active ? "text-white" : "text-foreground-icon-secondary")} aria-hidden />
      <span className={cx("text-body-medium whitespace-nowrap", active ? "text-white" : "text-text-secondary")}>
        {children}
      </span>
    </Link>
  );
}
