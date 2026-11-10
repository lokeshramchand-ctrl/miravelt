import { Skeleton, SkeletonText } from "@/components/base/skeleton/skeleton";

/** Shown while a dashboard page's server fetch is in flight. */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton shape="text" className="h-8 w-48" />
      <Skeleton shape="text" className="mt-2 h-4 w-72" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[132px] rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 rounded-3xl border border-border-button-default bg-background-primary-default p-5">
        <SkeletonText lines={6} />
      </div>
    </div>
  );
}
