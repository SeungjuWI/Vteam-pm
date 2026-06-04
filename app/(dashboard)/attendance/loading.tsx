import { Skeleton, SkeletonTitle, SkeletonCard } from "@/components/skeleton";

export default function AttendanceLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonTitle />
      <SkeletonCard className="flex items-center justify-center p-6">
        <Skeleton className="h-12 w-40 rounded-full" />
      </SkeletonCard>
      <SkeletonCard className="p-6">
        <Skeleton className="h-4 w-28" />
        <div className="mt-5 flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="ml-auto h-3.5 w-40" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
