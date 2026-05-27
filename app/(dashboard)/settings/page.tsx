export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-gray-900">설정</h1>

      <div className="rounded-xl bg-white p-6">
        <h2 className="text-sm font-medium text-gray-900">프로필 설정</h2>
        <p className="mt-1 text-sm text-gray-500">프로필 정보를 수정할 수 있습니다</p>
      </div>

      <div className="rounded-xl bg-white p-6">
        <h2 className="text-sm font-medium text-gray-900">회사 설정</h2>
        <p className="mt-1 text-sm text-gray-500">회사 정보를 관리할 수 있습니다</p>
      </div>
    </div>
  );
}
