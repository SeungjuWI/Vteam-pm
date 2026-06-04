import { Skeleton, SkeletonCard } from "@/components/skeleton";

// settings 레이아웃(탭 바)은 클라이언트 컴포넌트로 그대로 유지되고,
// 이 스켈레톤은 탭 아래 콘텐츠 자리에만 렌더된다.
export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonCard className="p-6">
        <Skeleton className="h-4 w-28" />
        <div className="mt-5 flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 flex-1 rounded-lg" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
