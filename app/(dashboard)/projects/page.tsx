import Link from "next/link";

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">프로젝트</h1>
        <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600">
          새 프로젝트
        </button>
      </div>

      {/* Project List */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white">
          <p className="text-sm text-gray-400">프로젝트를 추가하세요</p>
        </div>
      </div>
    </div>
  );
}
