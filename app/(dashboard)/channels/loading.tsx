import { Skeleton } from "@/components/skeleton";

export default function ChannelsLoading() {
  return (
    <div className="flex h-full gap-4">
      {/* 채널 목록 */}
      <div className="w-60 shrink-0 rounded-xl bg-white p-3">
        <Skeleton className="h-4 w-24" />
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      </div>
      {/* 메시지 영역 */}
      <div className="flex flex-1 flex-col rounded-xl bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-1 flex-col justify-end gap-5 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-2 h-3 w-3/4" />
                <Skeleton className="mt-1.5 h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
