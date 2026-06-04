// 페이지 전환 시 즉각적인 시각 피드백을 위한 스켈레톤 프리미티브.
// 실제 페이지 레이아웃(rounded-xl bg-white 카드)과 톤을 맞춘다.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200/80 ${className}`} />;
}

// 페이지 상단 제목 자리
export function SkeletonTitle({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-6 w-40 ${className}`} />;
}

// 흰색 카드 컨테이너 (실제 카드와 동일한 rounded-xl bg-white)
export function SkeletonCard({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return <div className={`rounded-xl bg-white p-5 ${className}`}>{children}</div>;
}

// 통계 카드 (라벨 + 숫자)
export function SkeletonStatCard() {
  return (
    <SkeletonCard>
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="mt-3 h-7 w-16" />
    </SkeletonCard>
  );
}

// 리스트 한 줄 (아바타 + 텍스트)
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-6 py-4">
      <Skeleton className="h-9 w-9 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="mt-2 h-3 w-20" />
      </div>
      <Skeleton className="h-3.5 w-16" />
    </div>
  );
}
