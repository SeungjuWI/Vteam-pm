export default function AttendancePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-gray-900">출퇴근 관리</h1>

      {/* Clock In/Out */}
      <div className="rounded-xl bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">현재 상태</p>
            <p className="mt-1 text-base font-medium text-gray-900">퇴근</p>
          </div>
          <button className="rounded-lg bg-blue-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600">
            출근하기
          </button>
        </div>
      </div>

      {/* Attendance List */}
      <div className="rounded-xl bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-medium text-gray-900">출퇴근 기록</h2>
        </div>
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-gray-400">출퇴근 기록이 없습니다</p>
        </div>
      </div>
    </div>
  );
}
