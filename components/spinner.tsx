// 페이지 전환 로딩 표시용 스피너. 스켈레톤 대신 단순한 회전 인디케이터를 쓴다.

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="로딩 중"
      className={`h-7 w-7 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-500 ${className}`}
    />
  );
}

// 페이지 전체 로딩 화면 (loading.tsx에서 사용)
export function PageSpinner() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Spinner />
    </div>
  );
}
