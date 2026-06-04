import { Skeleton, SkeletonCard } from "@/components/skeleton";

export default function ProjectDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="w-72 shrink-0">
            <Skeleton className="h-4 w-24" />
            <div className="mt-3 flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} className="p-4">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="mt-2 h-3 w-2/3" />
                  <div className="mt-4 flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="ml-auto h-4 w-12 rounded-full" />
                  </div>
                </SkeletonCard>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
