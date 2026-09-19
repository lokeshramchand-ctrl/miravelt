import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/dal";
import { adminBackendJson, BackendError } from "@/lib/backend";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import UserRowActions from "../UserRowActions";

interface DeviceSession {
  device_id: string;
  device_name: string;
  user_agent: string | null;
  ip_address: string | null;
  last_login: string;
  is_trusted: boolean;
  attestation_verified: boolean;
  created_at: string;
}

interface AdminUserDetail {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
  devices: DeviceSession[];
}

export default async function UserDetailPage(props: PageProps<"/dashboard/users/[id]">) {
  const { id } = await props.params;
  const { accessToken, user } = await requireAdminSession();

  let detail: AdminUserDetail;
  try {
    detail = await adminBackendJson<AdminUserDetail>(accessToken, `/admin/users/${id}`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <Link href="/dashboard/users" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        ← Back to users
      </Link>

      <div className="mt-3">
        <PageHeader
          title={detail.full_name || detail.email}
          description={detail.email}
          right={<UserRowActions userId={detail.id} isActive={detail.is_active} role={detail.role} isSelf={detail.id === user.id} />}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge status={detail.role === "admin" ? "ADMIN" : "USER"} />
        <StatusBadge status={detail.is_active ? "ACTIVE" : "DISABLED"} />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">User ID</dt>
          <dd className="mt-0.5 font-mono text-xs text-zinc-900 dark:text-zinc-100">{detail.id}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Joined</dt>
          <dd className="mt-0.5 text-zinc-900 dark:text-zinc-100">{new Date(detail.created_at).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Last updated</dt>
          <dd className="mt-0.5 text-zinc-900 dark:text-zinc-100">{new Date(detail.updated_at).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Devices</dt>
          <dd className="mt-0.5 text-zinc-900 dark:text-zinc-100">{detail.devices.length}</dd>
        </div>
      </dl>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Devices</h2>
      {detail.devices.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No devices on record.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-2 font-medium">Device</th>
                <th className="px-4 py-2 font-medium">IP address</th>
                <th className="px-4 py-2 font-medium">Trusted</th>
                <th className="px-4 py-2 font-medium">Attested</th>
                <th className="px-4 py-2 font-medium">Last login</th>
              </tr>
            </thead>
            <tbody>
              {detail.devices.map((d) => (
                <tr key={d.device_id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-3">
                    <p className="text-zinc-900 dark:text-zinc-100">{d.device_name}</p>
                    {d.user_agent && <p className="text-xs text-zinc-500 dark:text-zinc-400">{d.user_agent}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{d.ip_address ?? "—"}</td>
                  <td className="px-4 py-3">{d.is_trusted ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{d.attestation_verified ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{new Date(d.last_login).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
