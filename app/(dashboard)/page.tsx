export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-gray-900">대시보드</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">오늘 출근</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">0명</p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">진행 중 프로젝트</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">0개</p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">오늘 마감 태스크</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">0개</p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">전체 멤버</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">0명</p>
        </div>
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex h-64 items-center justify-center rounded-xl bg-white">
          <p className="text-sm text-gray-400">출퇴근 현황이 여기에 표시됩니다</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-xl bg-white">
          <p className="text-sm text-gray-400">최근 태스크가 여기에 표시됩니다</p>
        </div>
      </div>
    </div>
  );
}
