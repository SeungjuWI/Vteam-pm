"use client";

// [DEV] 현재안(메인+서브 막대) — 디자인 폴리시 v2. 오늘은 상단 ★마커, 끊기던 세로선 제거.
import { useState } from "react";

const MONTHS = ["6월", "7월", "8월", "9월", "10월"];
const N = MONTHS.length;
const FIRST_MONTH = 6; // 타임라인 시작 월(6월)
// 하위 태스크는 status 무관 동일 색(중립) — 상위만 색 변주
const SUB_SOLID = "bg-slate-300";
const SUB_RING = "ring-slate-200";

type Bar = { start: number; end: number };
type Status = "todo" | "in_progress" | "done";
type Sub = { id: string; title: string; status: Status; bar: Bar; assignee: string; priority: string };
type Row = { id: string; title: string; status: Status; progress: number; bar: Bar; assignee: string; priority: string; subs: Sub[] };

const ROWS: Row[] = [
  {
    id: "m1", title: "호치민 매칭위크", status: "in_progress", progress: 65, bar: { start: 0, end: 1 }, assignee: "남영훈", priority: "high",
    subs: [
      { id: "m1s1", title: "행사장 섭외", status: "done", bar: { start: 0, end: 0 }, assignee: "위승주", priority: "medium" },
      { id: "m1s2", title: "후보자 10명 컨택", status: "in_progress", bar: { start: 0, end: 1 }, assignee: "남영훈", priority: "high" },
      { id: "m1s3", title: "초청장 발송", status: "todo", bar: { start: 1, end: 1 }, assignee: "-", priority: "low" },
    ],
  },
  {
    id: "m2", title: "채용 파이프라인 자동화", status: "in_progress", progress: 40, bar: { start: 1, end: 2 }, assignee: "Mavis", priority: "medium",
    subs: [
      { id: "m2s1", title: "지원서 폼 설계", status: "done", bar: { start: 1, end: 1 }, assignee: "Mavis", priority: "medium" },
      { id: "m2s2", title: "Slack 알림 연동", status: "todo", bar: { start: 2, end: 2 }, assignee: "위승주", priority: "medium" },
    ],
  },
  { id: "m3", title: "다낭 매칭위크", status: "todo", progress: 0, bar: { start: 3, end: 4 }, assignee: "-", priority: "low", subs: [] },
];

const MILESTONES = [{ id: "ms1", title: "베타 론칭", at: 3 }];

const tone: Record<Status, { soft: string; solid: string; ring: string }> = {
  done: { soft: "bg-emerald-100", solid: "bg-emerald-500", ring: "ring-emerald-200" },
  in_progress: { soft: "bg-blue-100", solid: "bg-blue-500", ring: "ring-blue-200" },
  todo: { soft: "bg-slate-100", solid: "bg-slate-300", ring: "ring-slate-200" },
};
const statusLabel: Record<string, string> = { done: "완료", in_progress: "진행 중", todo: "할 일" };
const statusChip: Record<string, string> = { done: "bg-emerald-50 text-emerald-600", in_progress: "bg-blue-50 text-blue-600", todo: "bg-slate-100 text-slate-500" };
const prioChip: Record<string, { label: string; cls: string }> = {
  high: { label: "High", cls: "bg-rose-50 text-rose-500" },
  medium: { label: "Medium", cls: "bg-amber-50 text-amber-600" },
  low: { label: "Low", cls: "bg-slate-100 text-slate-500" },
};

function pct(i: number) { return (i / N) * 100; }
function barStyle(bar: Bar) { return { left: `calc(${pct(bar.start)}% + 4px)`, width: `calc(${pct(bar.end - bar.start + 1)}% - 8px)` }; }

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "xs" }) {
  if (name === "-") return null;
  const cls = size === "sm" ? "h-5 w-5 text-[9px]" : "h-4 w-4 text-[8px]";
  return <span className={`flex ${cls} items-center justify-center rounded-full bg-white font-medium text-gray-600 ring-2 ring-white`}>{name[0]}</span>;
}

/* 트랙 배경: 월 음영 + 경계선 (세로 가이드선 없음 — 끊김 방지) */
function Columns() {
  return (
    <div className="pointer-events-none absolute inset-0 flex">
      {MONTHS.map((_, i) => <div key={i} className={`flex-1 border-r border-gray-100 last:border-r-0 ${i % 2 === 1 ? "bg-gray-50/50" : ""}`} />)}
    </div>
  );
}

function Check({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 text-transparent hover:border-blue-400"}`}>
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
    </button>
  );
}

type Selected = { title: string; status: Status; bar: Bar; assignee: string; priority: string; isMain: boolean };

function SlidePanel({ task, onClose }: { task: Selected | null; onClose: () => void }) {
  const [desc, setDesc] = useState("");
  return (
    <>
      <div className={`fixed inset-0 z-40 bg-gray-900/15 transition-opacity ${task ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={onClose} />
      <div className={`fixed inset-y-0 right-0 z-50 flex w-[440px] max-w-[92vw] flex-col border-l border-gray-200 bg-white transition-transform duration-300 ease-out ${task ? "translate-x-0" : "translate-x-full"}`}>
        {task && (
          <>
            <div className="flex items-center justify-between px-6 py-4">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusChip[task.status]}`}>{statusLabel[task.status]}</span>
              <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition-colors active:scale-[0.95] hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <input defaultValue={task.title} className="w-full text-xl font-bold tracking-tight text-gray-900 focus:outline-none" />
              <div className="mt-6 flex flex-col gap-4">
                <Field label="담당자">{task.assignee === "-" ? <span className="text-sm text-gray-300">미지정</span> : <span className="inline-flex items-center gap-2 rounded-full bg-gray-50 py-1 pr-3 pl-1"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600">{task.assignee[0]}</span><span className="text-sm font-medium text-gray-700">{task.assignee}</span></span>}</Field>
                <Field label="기간"><span className="text-sm text-gray-700">{MONTHS[task.bar.start]} – {MONTHS[task.bar.end]}</span></Field>
                <Field label="우선순위"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${prioChip[task.priority].cls}`}>{prioChip[task.priority].label}</span></Field>
              </div>
              <div className="mt-7">
                <p className="mb-2 text-xs font-medium text-gray-600">설명</p>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} placeholder="설명을 입력하세요…"
                  className="w-full resize-none rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="mt-7">
                <p className="mb-2 text-xs font-medium text-gray-600">댓글</p>
                <p className="rounded-xl bg-gray-50 py-5 text-center text-xs text-gray-300">아직 댓글이 없습니다</p>
              </div>
            </div>
            <div className="px-6 py-4">
              <button className="w-full rounded-xl bg-blue-500 py-3 text-sm font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring active:scale-[0.98] hover:bg-blue-600 hover:shadow-brand">저장</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center gap-3"><span className="w-14 shrink-0 text-xs font-medium text-gray-600">{label}</span>{children}</div>;
}

export default function TimelineMock() {
  const [open, setOpen] = useState<Set<string>>(new Set(["m1", "m2"]));
  const [selected, setSelected] = useState<Selected | null>(null);
  const [done, setDone] = useState<Set<string>>(
    new Set([...ROWS.filter((r) => r.status === "done").map((r) => r.id), ...ROWS.flatMap((r) => r.subs.filter((s) => s.status === "done").map((s) => s.id))])
  );
  function toggle(id: string) { setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleDone(id: string) { setDone((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  // 오늘 — 매일 자동 업데이트
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayIdx = Math.max(0, Math.min(N - 1, curMonth - FIRST_MONTH));
  const todayPct = ((todayIdx + (curDay - 1) / daysInMonth) / N) * 100;
  const todayLabel = `${curMonth}/${curDay}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      {/* 헤더: 오늘 ★마커(월 위) + 월 축 */}
      <div className="flex items-stretch border-b border-gray-100 bg-gray-50/30">
        <div className="flex w-60 shrink-0 items-end px-5 pb-3"><span className="text-xs font-medium text-gray-600">태스크</span></div>
        <div className="relative flex flex-1 pt-7">
          {MONTHS.map((m, i) => (
            <div key={m} className="flex-1 px-2 pb-3 text-center">
              <span className={`text-xs font-medium ${i === todayIdx ? "text-rose-500" : "text-gray-500"}`}>{m}</span>
            </div>
          ))}
          {/* 오늘 마커 — 월 라벨 위, 날짜 포함 */}
          <div className="pointer-events-none absolute top-1.5 z-20 flex -translate-x-1/2 flex-col items-center" style={{ left: `${todayPct}%` }}>
            <div className="flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5">
              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.5l2.6 5.27 5.82.846-4.21 4.104.994 5.795L10 14.99l-5.204 2.735.994-5.795-4.21-4.104 5.82-.846z" /></svg>
              <span className="text-[9px] font-bold tracking-wide text-white">TODAY</span>
              <span className="text-[9px] font-semibold text-rose-100">{todayLabel}</span>
            </div>
            <span className="h-1.5 w-px bg-rose-400" />
          </div>
        </div>
      </div>

      <div>
        {ROWS.map((row) => {
          const tn = tone[row.status];
          const isOpen = open.has(row.id);
          const isDone = done.has(row.id);
          return (
            <div key={row.id}>
              {/* 메인 */}
              <div className="group flex items-center transition-colors hover:bg-gray-50/40">
                <div className="flex w-60 shrink-0 items-center gap-2 px-5 py-3">
                  <Check done={isDone} onClick={() => toggleDone(row.id)} />
                  <button onClick={() => toggle(row.id)} className="shrink-0 text-gray-300 transition-colors hover:text-gray-500">
                    {row.subs.length > 0 ? (
                      <svg className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    ) : <span className="block w-4" />}
                  </button>
                  <button onClick={() => setSelected({ ...row, isMain: true })} className={`truncate text-left text-sm font-medium transition-colors hover:text-blue-600 ${isDone ? "text-gray-300 line-through" : "text-gray-900"}`}>{row.title}</button>
                </div>
                <button onClick={() => setSelected({ ...row, isMain: true })} className="relative block h-12 flex-1 cursor-pointer">
                  <Columns />
                  <div className={`absolute top-1/2 flex h-7 -translate-y-1/2 items-center rounded-lg ring-1 ring-inset ${tn.ring} transition-all group-hover:ring-2`} style={barStyle(row.bar)}>
                    <div className={`absolute inset-0 rounded-lg ${tn.soft}`} />
                    <div className={`absolute inset-y-0 left-0 rounded-lg ${tn.solid}`} style={{ width: `${row.progress}%` }} />
                    <span className="relative z-10 ml-2.5 text-[11px] font-semibold text-gray-700">{row.progress}%</span>
                    <span className="absolute -right-1 top-1/2 z-10 -translate-y-1/2"><Avatar name={row.assignee} /></span>
                  </div>
                </button>
              </div>

              {/* 서브 — 하나로 이어지는 트리 가이드 */}
              {isOpen && row.subs.length > 0 && (
                <div className="relative">
                  <span className="pointer-events-none absolute left-[31px] top-0 bottom-3 w-px bg-gray-200" />
                  {row.subs.map((sub) => {
                    const sDone = done.has(sub.id);
                    return (
                      <div key={sub.id} className="group flex items-center transition-colors hover:bg-gray-50/40">
                        <div className="flex w-60 shrink-0 items-center gap-2 py-2 pr-4 pl-[44px]">
                          <Check done={sDone} onClick={() => toggleDone(sub.id)} />
                          <button onClick={() => setSelected({ ...sub, isMain: false })} className={`truncate text-left text-[13px] transition-colors hover:text-blue-600 ${sDone ? "text-gray-300 line-through" : "text-gray-600"}`}>{sub.title}</button>
                        </div>
                        <button onClick={() => setSelected({ ...sub, isMain: false })} className="relative block h-9 flex-1 cursor-pointer">
                          <Columns />
                          <div className={`absolute top-1/2 flex h-[18px] -translate-y-1/2 items-center rounded-md ${SUB_SOLID} transition-all group-hover:ring-2 ${SUB_RING}`} style={barStyle(sub.bar)}>
                            <span className="absolute -right-0.5 top-1/2 -translate-y-1/2"><Avatar name={sub.assignee} size="xs" /></span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                  <button className="flex items-center gap-1.5 py-2 pl-[44px] text-xs text-gray-300 transition-colors hover:text-blue-500">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    하위 태스크
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* 메인 추가 */}
        <button className="flex items-center gap-1.5 px-5 py-3 text-xs font-medium text-gray-400 transition-colors hover:text-blue-500">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          태스크 추가
        </button>

        {/* 마일스톤 (점선 없이 알약만) */}
        <div className="flex items-center border-t border-gray-100 bg-amber-50/30">
          <div className="flex w-60 shrink-0 items-center gap-1.5 px-5 py-3">
            <svg className="h-3 w-3 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l9 9-9 9-9-9z" /></svg>
            <span className="text-xs font-medium text-amber-700">마일스톤</span>
          </div>
          <div className="relative h-11 flex-1">
            <Columns />
            {MILESTONES.map((ms) => (
              <div key={ms.id} className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-1" style={{ left: `${pct(ms.at + 0.5)}%` }}>
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l9 9-9 9-9-9z" /></svg>
                <span className="whitespace-nowrap text-[10px] font-semibold text-white">{ms.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SlidePanel task={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
