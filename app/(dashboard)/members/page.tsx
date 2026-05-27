export default function MembersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">멤버 관리</h1>
        <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600">
          멤버 초대
        </button>
      </div>

      {/* Member List */}
      <div className="rounded-xl bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-medium text-gray-900">멤버 목록</h2>
        </div>
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-gray-400">멤버가 없습니다</p>
        </div>
      </div>
    </div>
  );
}
