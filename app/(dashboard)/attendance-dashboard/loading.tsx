import { Skeleton, SkeletonTitle, SkeletonStatCard, SkeletonCard } from "@/components/skeleton";

export default function AttendanceDashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonTitle />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      <SkeletonCard className="p-0">
        <div className="border-b border-gray-100 px-6 py-4">
          <Skeleton className="h-4 w-28" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 last:border-0">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
            <Skeleton className="h-3.5 w-24" />
          </div>
        ))}
      </SkeletonCard>
    </div>
  );
}
