"use client";

import { useState } from "react";
import Link from "next/link";

import StatusBadge from "@/components/StatusBadge";
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

  const filtered = users.filter((u) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return u.email.toLowerCase().includes(needle) || (u.full_name ?? "").toLowerCase().includes(needle);
  });

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <input
          type="search"
          placeholder="Search by email or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-sm rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Devices</th>
              <th className="px-4 py-2 font-medium">Joined</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/users/${u.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                    {u.full_name || u.email}
                  </Link>
                  {u.full_name && <p className="text-xs text-zinc-500 dark:text-zinc-400">{u.email}</p>}
                  {u.id === currentUserId && (
                    <span className="mt-0.5 inline-block text-xs text-zinc-400 dark:text-zinc-500">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={u.role === "admin" ? "ADMIN" : "USER"} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={u.is_active ? "ACTIVE" : "DISABLED"} />
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{u.device_count}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <UserRowActions userId={u.id} isActive={u.is_active} role={u.role} isSelf={u.id === currentUserId} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No users match &quot;{query}&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
