import { notFound } from "next/navigation";
import { RiArrowLeftLine, RiCheckLine, RiCloseLine, RiSmartphoneLine } from "@remixicon/react";

import { requireAdminSession } from "@/lib/dal";
import { adminBackendJson, BackendError } from "@/lib/backend";
import { initialsFor } from "@/lib/initials";
import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import StatusBadge from "@/components/StatusBadge";
import EmptyRow from "@/components/EmptyRow";
import { Avatar } from "@/components/base/avatar/avatar";
import { LinkButton } from "@/components/base/buttons/link-button";
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

  const name = detail.full_name || detail.email;

  return (
    <div>
      <LinkButton href="/dashboard/users" variant="secondary" size="small" leadingIcon={RiArrowLeftLine}>
        Users
      </LinkButton>

      <div className="mt-4">
        <PageHeader
          title={
            <span className="flex items-center gap-3">
              <Avatar size="lg" color={detail.role === "admin" ? "blue" : "neutral"} initials={initialsFor(detail.full_name, detail.email)} />
              <span className="min-w-0 truncate">{name}</span>
            </span>
          }
          description={
            <span className="flex flex-wrap items-center gap-2">
              {detail.full_name && <span>{detail.email}</span>}
              <StatusBadge status={detail.role === "admin" ? "ADMIN" : "USER"} />
              <StatusBadge status={detail.is_active ? "ACTIVE" : "DISABLED"} />
            </span>
          }
          right={<UserRowActions userId={detail.id} label={name} isActive={detail.is_active} role={detail.role} isSelf={detail.id === user.id} />}
        />
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="User ID" value={<span className="font-mono text-body-2-regular break-all">{detail.id}</span>} />
        <Fact label="Joined" value={new Date(detail.created_at).toLocaleString()} />
        <Fact label="Last updated" value={new Date(detail.updated_at).toLocaleString()} />
        <Fact label="Devices" value={<span className="text-title-3-medium tabular-nums">{detail.devices.length}</span>} />
      </dl>

      <Panel className="mt-6" title="Devices" description="Sessions this account has signed in from.">
        <div className="overflow-x-auto">
          <table className="bui-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>IP address</th>
                <th>Trusted</th>
                <th>Attested</th>
                <th>Last login</th>
              </tr>
            </thead>
            <tbody>
              {detail.devices.map((d) => (
                <tr key={d.device_id} className="hover:bg-background-secondary-hover">
                  <td>
                    <p className="text-body-medium text-text-primary">{d.device_name}</p>
                    {d.user_agent && <p className="max-w-sm truncate text-body-2-regular text-text-tertiary" title={d.user_agent}>{d.user_agent}</p>}
                  </td>
                  <td className="font-mono text-body-2-regular text-text-secondary">{d.ip_address ?? "—"}</td>
                  <td>
                    <YesNo value={d.is_trusted} />
                  </td>
                  <td>
                    <YesNo value={d.attestation_verified} />
                  </td>
                  <td className="whitespace-nowrap text-text-secondary">{new Date(d.last_login).toLocaleString()}</td>
                </tr>
              ))}
              {detail.devices.length === 0 && <EmptyRow colSpan={5} icon={RiSmartphoneLine} title="No devices on record" />}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-background-secondary-default p-4">
      <dt className="text-body-2-medium text-text-tertiary">{label}</dt>
      <dd className="mt-1 text-body-medium text-text-primary">{value}</dd>
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-status-lime-text">
      <RiCheckLine className="size-4" aria-hidden /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-text-tertiary">
      <RiCloseLine className="size-4" aria-hidden /> No
    </span>
  );
}
