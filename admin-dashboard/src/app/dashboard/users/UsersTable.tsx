"use client";

import { useState } from "react";
import Link from "next/link";
import { RiUserSearchLine } from "@remixicon/react";

import StatusBadge from "@/components/StatusBadge";
import EmptyRow from "@/components/EmptyRow";
import Panel from "@/components/Panel";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip } from "@/components/base/badges/chip";
import { SearchField } from "@/components/base/search-field/search-field";
import { initialsFor } from "@/lib/initials";
import UserRowActions from "./UserRowActions";

export interface AdminUserSummary {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role: "user" | "admin";
  device_count: number;
  created_at: string;
}

export default function UsersTable({ users, currentUserId }: { users: AdminUserSummary[]; currentUserId: string }) {
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? users.filter((u) => u.email.toLowerCase().includes(needle) || (u.full_name ?? "").toLowerCase().includes(needle))
    : users;

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <SearchField aria-label="Search users" placeholder="Search by email or name…" value={query} onChange={setQuery} className="w-full max-w-sm" />
        {needle && (
          <span className="text-body-2-regular text-text-tertiary">
            {filtered.length} of {users.length}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="bui-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th className="!text-end">Devices</th>
              <th>Joined</th>
              <th className="!text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-background-secondary-hover">
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar size="md" color={u.role === "admin" ? "blue" : "neutral"} initials={initialsFor(u.full_name, u.email)} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/dashboard/users/${u.id}`}
                          className="truncate rounded-sm text-body-medium text-text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                        >
                          {u.full_name || u.email}
                        </Link>
                        {u.id === currentUserId && (
                          <Chip variant="caption" color="soft" className="!py-0">
                            you
                          </Chip>
                        )}
                      </div>
                      {u.full_name && <p className="truncate text-body-2-regular text-text-tertiary">{u.email}</p>}
                    </div>
                  </div>
                </td>
                <td>
                  <StatusBadge status={u.role === "admin" ? "ADMIN" : "USER"} />
                </td>
                <td>
                  <StatusBadge status={u.is_active ? "ACTIVE" : "DISABLED"} />
                </td>
                <td className="text-end text-text-secondary tabular-nums">{u.device_count}</td>
                <td className="whitespace-nowrap text-text-secondary">{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  <UserRowActions userId={u.id} label={u.full_name || u.email} isActive={u.is_active} role={u.role} isSelf={u.id === currentUserId} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <EmptyRow colSpan={6} icon={RiUserSearchLine} title={needle ? `No users match “${query.trim()}”` : "No users yet"} hint={needle ? "Search matches email and full name." : undefined} />
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
