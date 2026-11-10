import {
  RiAndroidLine,
  RiFlashlightLine,
  RiGroupLine,
  RiRepeatLine,
  RiShieldUserLine,
  RiTimerLine,
  RiUserFollowLine,
} from "@remixicon/react";

import { requireAdminSession } from "@/lib/dal";
import { adminBackendJson } from "@/lib/backend";
import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import KpiCard from "@/components/KpiCard";
import StatusBadge, { statusColor } from "@/components/StatusBadge";
import type { ChipColor } from "@/components/base/badges/chip";
import { Chip } from "@/components/base/badges/chip";

interface Overview {
  users: { total: number; active: number; admins: number };
  jobs_by_status: Record<string, number>;
  statements_by_status: Record<string, number>;
  latest_releases: Record<string, { version_name: string; version_code: number; uploaded_at: string }>;
  activation_metrics: {
    activation_rate_24h: number;
    median_seconds_to_insight: number | null;
    return_use_rate: number;
    sample_size: { total_users: number; users_with_a_statement: number };
  };
}

export default async function OverviewPage() {
  const { accessToken } = await requireAdminSession();
  const overview = await adminBackendJson<Overview>(accessToken, "/admin/overview");
  const { users, activation_metrics: activation } = overview;

  return (
    <div>
      <PageHeader title="Overview" description="A snapshot of the system right now." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={RiGroupLine} label="Total users" value={users.total.toLocaleString()} />
        <KpiCard
          icon={RiUserFollowLine}
          label="Active users"
          value={users.active.toLocaleString()}
          note={users.total > 0 ? `${percent(users.active / users.total)} of all` : undefined}
          noteColor="lime"
        />
        <KpiCard icon={RiShieldUserLine} label="Admins" value={users.admins.toLocaleString()} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatusBreakdown title="Jobs by status" counts={overview.jobs_by_status} />
        <StatusBreakdown title="Statements by status" counts={overview.statements_by_status} />
      </div>

      <Panel
        className="mt-6"
        title="Activation funnel"
        description={`${activation.sample_size.users_with_a_statement.toLocaleString()} of ${activation.sample_size.total_users.toLocaleString()} users have uploaded a statement.`}
        bodyClassName="grid grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-3"
      >
        <KpiCard icon={RiFlashlightLine} label="Activated within 24h" value={percent(activation.activation_rate_24h)} />
        <KpiCard
          icon={RiTimerLine}
          label="Median time to insight"
          value={activation.median_seconds_to_insight === null ? "—" : formatSeconds(activation.median_seconds_to_insight)}
        />
        <KpiCard icon={RiRepeatLine} label="Return use (2+ periods)" value={percent(activation.return_use_rate)} />
      </Panel>

      <Panel className="mt-6" title="Latest releases" bodyClassName="px-3 pb-3">
        {Object.keys(overview.latest_releases).length === 0 ? (
          <p className="px-2 pb-2 text-body-regular text-text-secondary">No releases published yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(overview.latest_releases).map(([platform, release]) => (
              <div key={platform} className="flex items-center gap-3 rounded-2xl bg-background-secondary-default p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2lg bg-linear-to-b from-lime-500 to-lime-600">
                  <RiAndroidLine className="size-5 text-white" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-caption-1-medium text-text-tertiary capitalize">{platform}</p>
                  <p className="text-title-3-medium text-text-primary">{release.version_name}</p>
                </div>
                <div className="text-end">
                  <Chip variant="caption" color="soft">
                    build {release.version_code}
                  </Chip>
                  <p className="mt-1 text-caption-1-regular text-text-tertiary">
                    {new Date(release.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Share of a total; a non-zero sliver reads "<1%" rather than a misleading "0%". */
function share(n: number, total: number): string {
  const ratio = n / total;
  return n > 0 && ratio < 0.005 ? "<1%" : percent(ratio);
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

/** Bar fill per chip colour (the chip's own text token), so the bar and the legend chips agree in both themes. */
const BAR: Record<ChipColor, string> = {
  lime: "bg-status-lime-text",
  blue: "bg-status-blue-text",
  rose: "bg-status-rose-text",
  purple: "bg-status-purple-text",
  orange: "bg-status-orange-text",
  yellow: "bg-status-yellow-text",
  cyan: "bg-status-cyan-text",
  neutral: "bg-text-tertiary",
  gray: "bg-text-tertiary",
  soft: "bg-text-placeholder",
};

/** Counts per status as one proportion bar plus a legend with counts and shares. */
function StatusBreakdown({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);

  return (
    <Panel title={title} action={<span className="text-title-3-medium text-text-primary tabular-nums">{total.toLocaleString()}</span>} bodyClassName="px-5 pb-5">
      {total === 0 ? (
        <p className="text-body-regular text-text-secondary">Nothing yet.</p>
      ) : (
        <>
          <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={entries.map(([s, n]) => `${s}: ${n}`).join(", ")}>
            {entries
              .filter(([, n]) => n > 0)
              .map(([status, n]) => (
                <span key={status} className={`h-full first:rounded-s-full last:rounded-e-full ${BAR[statusColor(status)]}`} style={{ width: `${(n / total) * 100}%` }} />
              ))}
          </div>
          <dl className="mt-4 flex flex-col gap-2.5">
            {entries.map(([status, n]) => (
              <div key={status} className="flex items-center justify-between gap-3">
                <dt>
                  <StatusBadge status={status} />
                </dt>
                <dd className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-body-medium text-text-primary">{n.toLocaleString()}</span>
                  <span className="w-10 text-end text-body-2-regular text-text-tertiary">{share(n, total)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Panel>
  );
}
