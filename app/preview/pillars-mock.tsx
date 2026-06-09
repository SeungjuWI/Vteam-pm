// [DEV] 큰 필라 개요 목업 — 진척률 매트릭스 대신, 고정된 큰 프로젝트를 빡 잡는 구조.
import Link from "next/link";

type Pillar = {
  id: string; name: string; accent: string;
  members: string[];
  nextMilestone: { title: string; date: string } | null;
};

const PILLARS: Pillar[] = [
  { id: "ktc", name: "KTC", accent: "from-blue-500 to-indigo-600", members: ["남영훈", "위승주", "Mavis", "My"], nextMilestone: { title: "호치민 매칭위크", date: "6/30" } },
  { id: "fyi", name: "FYI", accent: "from-violet-500 to-purple-600", members: ["남영훈", "위승주"], nextMilestone: { title: "베타 론칭", date: "9/1" } },
  { id: "corp", name: "법인 관리", accent: "from-emerald-500 to-teal-600", members: ["Mavis"], nextMilestone: null },
];

export default function PillarsMock() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {PILLARS.map((p) => (
        <Link
          key={p.id}
          href={`/preview/${p.id}`}
          className="group relative flex h-56 flex-col justify-between overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 transition-all hover:border-blue-200 hover:ring-4 hover:ring-blue-50"
        >
          {/* 상단 컬러 악센트 */}
          <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${p.accent}`} />

          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-gray-900">{p.name}</h3>
            {/* 팀 */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                {p.members.slice(0, 4).map((m, i) => (
                  <span key={i} className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[11px] font-medium text-gray-600 ring-2 ring-white">{m[0]}</span>
                ))}
              </div>
              <span className="text-xs text-gray-400">{p.members.length}명</span>
            </div>
          </div>

          <div className="flex items-end justify-between">
            {/* 다음 마일스톤 */}
            {p.nextMilestone ? (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1">
                <svg className="h-2.5 w-2.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l9 9-9 9-9-9z" /></svg>
                <span className="text-[11px] font-medium text-amber-700">{p.nextMilestone.title} · {p.nextMilestone.date}</span>
              </div>
            ) : <span className="text-[11px] text-gray-300">예정된 마일스톤 없음</span>}

            <span className="flex items-center gap-1 text-sm font-medium text-gray-300 transition-colors group-hover:text-blue-500">
              열기
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
