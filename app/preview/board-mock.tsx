"use client";

// [DEV] 보드 뷰(status별 칸반) 목업. 디자인 확인용.
type Status = "todo" | "in_progress" | "done";
type Card = { id: string; title: string; status: Status; priority: string; assignee: string };

const CARDS: Card[] = [
  { id: "c1", title: "호치민 매칭위크", status: "in_progress", priority: "high", assignee: "남영훈" },
  { id: "c2", title: "후보자 10명 컨택", status: "in_progress", priority: "high", assignee: "남영훈" },
  { id: "c3", title: "채용 파이프라인 자동화", status: "in_progress", priority: "medium", assignee: "Mavis" },
  { id: "c4", title: "초청장 발송", status: "todo", priority: "low", assignee: "-" },
  { id: "c5", title: "다낭 매칭위크", status: "todo", priority: "low", assignee: "-" },
  { id: "c6", title: "Slack 알림 연동", status: "todo", priority: "medium", assignee: "위승주" },
  { id: "c7", title: "행사장 섭외", status: "done", priority: "medium", assignee: "위승주" },
  { id: "c8", title: "지원서 폼 설계", status: "done", priority: "medium", assignee: "Mavis" },
];

const COLUMNS: { key: Status; label: string; dot: string }[] = [
  { key: "todo", label: "할 일", dot: "bg-gray-400" },
  { key: "in_progress", label: "진행 중", dot: "bg-blue-500" },
  { key: "done", label: "완료", dot: "bg-green-500" },
];

const prioChip: Record<string, { label: string; cls: string }> = {
  high: { label: "High", cls: "bg-red-50 text-red-500" },
  medium: { label: "Medium", cls: "bg-amber-50 text-amber-600" },
  low: { label: "Low", cls: "bg-gray-100 text-gray-500" },
};

export default function BoardMock() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {COLUMNS.map((col) => {
        const cards = CARDS.filter((c) => c.status === col.key);
        return (
          <div key={col.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              <h3 className="text-sm font-medium text-gray-700">{col.label}</h3>
              <span className="text-xs text-gray-600">{cards.length}</span>
            </div>
            <div className="flex min-h-[120px] flex-col gap-2 rounded-xl bg-white p-3">
              {cards.map((c) => {
                const pc = prioChip[c.priority];
                return (
                  <div key={c.id} className="cursor-pointer rounded-lg border border-gray-100 p-3 transition-colors hover:border-gray-200">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${c.status === "done" ? "text-gray-400 line-through" : "text-gray-900"}`}>{c.title}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${pc.cls}`}>{pc.label}</span>
                    </div>
                    {c.assignee !== "-" && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[9px] font-medium text-gray-600">{c.assignee[0]}</span>
                        <span className="text-[11px] text-gray-600">{c.assignee}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              <button className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 py-2 text-xs text-gray-300 transition-colors hover:border-gray-300 hover:text-gray-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                추가
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
