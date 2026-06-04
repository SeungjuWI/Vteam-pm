import { Skeleton, SkeletonTitle, SkeletonStatCard, SkeletonCard } from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonTitle />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      <SkeletonCard className="p-6">
        <Skeleton className="h-4 w-28" />
        <div className="mt-5 flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="ml-auto h-3.5 w-32" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
