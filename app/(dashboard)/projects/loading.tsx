import { Skeleton, SkeletonTitle, SkeletonCard } from "@/components/skeleton";

export default function ProjectsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SkeletonTitle />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-2/3" />
            <div className="mt-5 flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="ml-auto h-5 w-14 rounded-full" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
