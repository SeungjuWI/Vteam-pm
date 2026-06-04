import { Skeleton, SkeletonTitle, SkeletonStatCard, SkeletonCard } from "@/components/skeleton";

export default function MyTasksLoading() {
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
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 last:border-0">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
        ))}
      </SkeletonCard>
    </div>
  );
}
