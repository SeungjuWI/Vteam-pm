// [DEV] 로그인 없이 새 UI를 목업으로 미리보는 페이지. 프로젝트 누르면 /preview/[id] 상세로 이동.
import PillarsMock from "./pillars-mock";

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          <span>[DEV 프리뷰] 로그인 없이 목업으로 보는 화면. 저장은 동작하지 않습니다.</span>
          <a href="/preview/compare" className="font-medium underline hover:text-amber-900">디자인 비교 보기 →</a>
        </div>

        <section>
          <h2 className="mb-1 text-sm font-medium text-gray-600">프로젝트 — 큰 필라(단순안)</h2>
          <p className="mb-4 text-xs text-gray-600">진척률 매트릭스 대신 고정된 큰 프로젝트만. 클릭하면 상세(팀 + 마일스톤).</p>
          <PillarsMock />
        </section>
      </div>
    </div>
  );
}
