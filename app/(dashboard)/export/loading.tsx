import { Skeleton, SkeletonTitle, SkeletonCard } from "@/components/skeleton";

export default function ExportLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonTitle />
      <SkeletonCard className="p-6">
        <Skeleton className="h-4 w-28" />
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <Skeleton className="mt-5 h-10 w-32 rounded-lg" />
      </SkeletonCard>
    </div>
  );
}
