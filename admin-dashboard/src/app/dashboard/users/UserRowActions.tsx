"use client";

import { useState, useTransition } from "react";

import { toggleUserActive, updateUserRole, deleteUser } from "./actions";

export default function UserRowActions({
  userId,
  isActive,
  role,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  role: "user" | "admin";
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() => run(() => toggleUserActive(userId, !isActive))}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {isActive ? "Disable" : "Enable"}
        </button>

        {!isSelf && (
          <button
            disabled={pending}
            onClick={() => run(() => updateUserRole(userId, role === "admin" ? "user" : "admin"))}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {role === "admin" ? "Demote" : "Promote"}
          </button>
        )}

        <button
          disabled={pending}
          onClick={() => {
            if (confirm("Soft-delete this user? Their account will be disabled and all sessions revoked.")) {
              run(() => deleteUser(userId));
            }
          }}
          className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
        >
          Delete
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
