// [DEV] 디자인 비교 페이지. 같은 화면의 대안들을 나란히 보고 고르는 곳.
import Link from "next/link";
import TimelineMock from "../timeline-mock";
import TimelineClean from "../timeline-clean";
import TimelineInteractive from "../timeline-interactive";

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">디자인 비교 — 프로젝트 상세 타임라인</h1>
          <Link href="/preview" className="text-sm text-gray-500 hover:text-gray-900">← 프리뷰</Link>
        </div>

        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-700">현재안 — 메인+서브 모두 막대 (주렁주렁)</h2>
            <p className="text-xs text-gray-600">서브태스크도 각자 타임라인 막대. ▾로 펼침. 서브 일정까지 보이지만 행이 늘어남.</p>
          </div>
          <TimelineMock />
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-700">A안 — 타임라인엔 메인만, 서브는 패널 체크리스트 (추천)</h2>
            <p className="text-xs text-gray-600">타임라인은 메인 막대만(깔끔). 막대 채움 = 서브 완료율. 태스크 클릭 → 오른쪽 패널에서 하위 태스크 체크리스트.</p>
          </div>
          <TimelineClean />
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-700">A안 + 태스크 추가 동작 (직접 만져보기)</h2>
            <p className="text-xs text-gray-600">제목+Enter로 추가 · 막대 가운데 드래그=이동, 끝 드래그=기간조정 · 아래 빈 줄 가로 드래그=기간부터 생성.</p>
          </div>
          <TimelineInteractive />
        </section>
      </div>
    </div>
  );
}
