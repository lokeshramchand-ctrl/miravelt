"use client";

import { useState, useTransition } from "react";
import { RiDeleteBinLine } from "@remixicon/react";

import { Button } from "@/components/base/buttons/button";
import { AlertDialog } from "@/components/base/modal/modal";
import { toggleUserActive, updateUserRole, deleteUser } from "./actions";

export default function UserRowActions({
  userId,
  label,
  isActive,
  role,
  isSelf,
}: {
  userId: string;
  /** Name or email, for the delete confirmation. */
  label: string;
  isActive: boolean;
  role: "user" | "admin";
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="small" disabled={pending} onClick={() => run(() => toggleUserActive(userId, !isActive))}>
          {isActive ? "Disable" : "Enable"}
        </Button>

        {!isSelf && (
          <Button variant="ghost" size="small" disabled={pending} onClick={() => run(() => updateUserRole(userId, role === "admin" ? "user" : "admin"))}>
            {role === "admin" ? "Demote" : "Promote"}
          </Button>
        )}

        <Button
          variant="secondary"
          size="small"
          iconOnly
          leadingIcon={RiDeleteBinLine}
          aria-label={`Delete ${label}`}
          title="Delete user"
          disabled={pending}
          className="text-text-destructive"
          onClick={() => {
            setDeleteError(null);
            setConfirmDelete(true);
          }}
        />
      </div>
      {error && <p className="text-body-2-regular text-text-error-primary">{error}</p>}

      <AlertDialog
        isOpen={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${label}?`}
        description="This is a soft delete: the account is disabled and every session is revoked."
        confirmLabel="Delete user"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          const result = await deleteUser(userId);
          if (result.error) {
            setDeleteError(result.error);
            throw new Error(result.error); // keeps the dialog open
          }
        }}
      >
        {deleteError && <p className="text-body-regular text-text-error-primary">{deleteError}</p>}
      </AlertDialog>
    </div>
  );
}
