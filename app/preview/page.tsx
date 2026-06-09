// [DEV] 로그인 없이 새 UI를 목업으로 미리보는 페이지. 프로젝트 누르면 /preview/[id] 상세로 이동.
import ProjectTimelineMatrix from "../(dashboard)/projects/project-timeline-matrix";
import type { Member } from "../(dashboard)/projects/[id]/project-types";

const members: Member[] = [
  { id: "m1", name: "남영훈", email: "a@x.com", avatarUrl: null, position: "PM" },
  { id: "m2", name: "위승주", email: "b@x.com", avatarUrl: null, position: "개발" },
  { id: "m3", name: "Mavis", email: "c@x.com", avatarUrl: null, position: "디자인" },
];

const columns = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];

function cell(progress: number, done: number, total: number, titles: string[]) {
  return {
    progress,
    done,
    total,
    tasks: titles.map((title, i) => ({ id: `${title}-${i}`, title, completion: i === 0 ? progress : 0 })),
  };
}

type MCell = { progress: number; done: number; total: number; tasks: { id: string; title: string; completion: number }[] };
type MProject = { id: string; name: string; status: string; overall: number; cells: Record<string, MCell> };

const matrixProjects: MProject[] = [
  {
    id: "ktc", name: "KTC", status: "active", overall: 32,
    cells: {
      "2026-06": cell(60, 3, 5, ["호치민 매칭위크 준비", "후보자 5명 컨택", "JD 정리"]),
      "2026-07": cell(20, 1, 5, ["다낭 매칭위크", "현지 파트너 미팅"]),
      "2026-08": cell(0, 0, 3, ["한-베 휴가철 캠페인"]),
    },
  },
  {
    id: "fyi", name: "FYI", status: "active", overall: 40,
    cells: {
      "2026-06": cell(80, 4, 5, ["랜딩 카피 QA", "결제 정책 확정", "가격표 개편"]),
      "2026-07": cell(45, 2, 4, ["광고 수치 정정", "테스티모니얼 익명화"]),
      "2026-08": cell(10, 0, 2, ["ATS 프리뷰 마스킹"]),
    },
  },
  {
    id: "hire", name: "채용공고", status: "completed", overall: 100,
    cells: {
      "2026-06": cell(100, 3, 3, ["공고 3건 게시 완료", "지원자 풀 정리", "면접 일정 확정"]),
    },
  },
];

const totals = {
  "2026-06": { progress: 73, done: 10, total: 13 },
  "2026-07": { progress: 28, done: 3, total: 9 },
  "2026-08": { progress: 3, done: 0, total: 5 },
};

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          <span>[DEV 프리뷰] 로그인 없이 목업으로 보는 화면. 저장은 동작하지 않습니다.</span>
          <a href="/preview/compare" className="font-medium underline hover:text-amber-900">디자인 비교 보기 →</a>
        </div>

        <section>
          <h2 className="mb-1 text-sm font-medium text-gray-400">프로젝트 목록 — 타임라인 매트릭스</h2>
          <p className="mb-3 text-xs text-gray-400">프로젝트 이름을 누르면 상세(마일스톤/보드)로 들어갑니다.</p>
          <ProjectTimelineMatrix projects={matrixProjects} columns={columns} totals={totals} members={members} basePath="/preview" />
        </section>
      </div>
    </div>
  );
}
