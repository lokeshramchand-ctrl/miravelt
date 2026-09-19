import { requireAdminSession } from "@/lib/dal";
import { adminBackendJson } from "@/lib/backend";
import PageHeader from "@/components/PageHeader";
import UsersTable, { type AdminUserSummary } from "./UsersTable";

export default async function UsersPage() {
  const { accessToken, user } = await requireAdminSession();
  const users = await adminBackendJson<AdminUserSummary[]>(accessToken, "/admin/users");

  return (
    <div>
      <PageHeader title="Users" description={`${users.length} user${users.length === 1 ? "" : "s"} total.`} />
      <UsersTable users={users} currentUserId={user.id} />
    </div>
  );
}
