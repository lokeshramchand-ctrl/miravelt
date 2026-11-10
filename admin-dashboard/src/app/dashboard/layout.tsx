import { RiLogoutBoxRLine } from "@remixicon/react";

import { requireAdminSession } from "@/lib/dal";
import NavLink, { type NavIcon } from "@/components/NavLink";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { logoutAction } from "./actions";

const NAV_ITEMS: { href: string; label: string; icon: NavIcon }[] = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/users", label: "Users", icon: "users" },
  { href: "/dashboard/jobs", label: "Jobs", icon: "jobs" },
  { href: "/dashboard/statements", label: "Statements", icon: "statements" },
  { href: "/dashboard/releases", label: "Releases", icon: "releases" },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-2lg bg-text-primary text-headline-semibold text-background-full shadow-xs">
        M
      </span>
      <span className="text-headline-semibold text-text-primary">Miravelt</span>
      <Chip variant="caption" color="soft">
        Admin
      </Chip>
    </div>
  );
}

function SignOut() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="small" iconOnly leadingIcon={RiLogoutBoxRLine} aria-label="Sign out" title="Sign out" />
    </form>
  );
}

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user } = await requireAdminSession();
  const initial = user.email.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen gap-4 lg:p-4">
      {/* Floating sidebar, BoardUI's dashboard rail (lg and up) */}
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[248px] shrink-0 flex-col justify-between rounded-3xl border border-border-button-white bg-background-secondary-default p-3 shadow-sidebar lg:flex">
        <div className="flex flex-col gap-5">
          <div className="px-1 pt-1">
            <Brand />
          </div>
          <nav aria-label="Main" className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-2 rounded-2lg bg-background-primary-default p-2 shadow-card">
            <Avatar size="md" color="blue" initials={initial} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-medium text-text-primary">{user.email}</p>
              <p className="text-caption-1-regular text-text-tertiary">Administrator</p>
            </div>
            <SignOut />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Narrow screens: brand, theme and sign-out on top, nav scrolls sideways under it */}
        <header className="sticky top-0 z-20 border-b border-separator-border bg-background-full/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <Brand />
            <div className="flex items-center gap-1">
              <ThemeToggle appearance="segmented" size="small" />
              <SignOut />
            </div>
          </div>
          <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon} compact>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-6 lg:py-4">{children}</main>
      </div>
    </div>
  );
}
