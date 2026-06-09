"use client";

// [DEV] A안: 타임라인엔 메인 태스크만(깔끔), 서브태스크는 오른쪽 패널 체크리스트로. 디자인 비교용.
import { useState } from "react";

const MONTHS = ["6월", "7월", "8월", "9월", "10월"];
const N = MONTHS.length;

type Bar = { start: number; end: number };
type Status = "todo" | "in_progress" | "done";
type Sub = { id: string; title: string; status: Status; due: string };
type Row = { id: string; title: string; status: Status; bar: Bar; assignee: string; priority: string; subs: Sub[] };

const ROWS: Row[] = [
  {
    id: "m1", title: "호치민 매칭위크", status: "in_progress", bar: { start: 0, end: 1 }, assignee: "남영훈", priority: "high",
    subs: [
      { id: "m1s1", title: "행사장 섭외", status: "done", due: "6/15" },
      { id: "m1s2", title: "후보자 10명 컨택", status: "done", due: "6/20" },
      { id: "m1s3", title: "초청장 발송", status: "todo", due: "6/25" },
      { id: "m1s4", title: "현장 스태프 배정", status: "todo", due: "6/28" },
      { id: "m1s5", title: "결과 리포트", status: "todo", due: "7/5" },
    ],
  },
  {
    id: "m2", title: "채용 파이프라인 자동화", status: "in_progress", bar: { start: 1, end: 2 }, assignee: "Mavis", priority: "medium",
    subs: [
      { id: "m2s1", title: "지원서 폼 설계", status: "done", due: "7/8" },
      { id: "m2s2", title: "Slack 알림 연동", status: "todo", due: "7/20" },
    ],
  },
  { id: "m3", title: "다낭 매칭위크", status: "todo", bar: { start: 3, end: 4 }, assignee: "-", priority: "low", subs: [
    { id: "m3s1", title: "현지 파트너 미팅", status: "todo", due: "9/10" },
    { id: "m3s2", title: "행사장 후보 조사", status: "todo", due: "9/20" },
    { id: "m3s3", title: "예산 승인", status: "todo", due: "9/25" },
  ] },
];

const MILESTONES = [{ id: "ms1", title: "베타 론칭", at: 3 }];

const fill: Record<string, string> = { done: "bg-green-500", in_progress: "bg-blue-500", todo: "bg-gray-300" };
const barBg: Record<string, string> = { done: "bg-green-100", in_progress: "bg-blue-100", todo: "bg-gray-100" };
const statusLabel: Record<string, string> = { done: "완료", in_progress: "진행 중", todo: "할 일" };
const statusChip: Record<string, string> = { done: "bg-green-50 text-green-600", in_progress: "bg-blue-50 text-blue-600", todo: "bg-gray-100 text-gray-500" };
const prioChip: Record<string, { label: string; cls: string }> = {
  high: { label: "High", cls: "bg-red-50 text-red-500" },
  medium: { label: "Medium", cls: "bg-amber-50 text-amber-600" },
  low: { label: "Low", cls: "bg-gray-100 text-gray-500" },
};

function pct(i: number) { return (i / N) * 100; }
function GridBg() {
  return <div className="pointer-events-none absolute inset-0 flex">{MONTHS.map((_, i) => <div key={i} className="flex-1 border-r border-gray-100 last:border-r-0" />)}</div>;
}

export default function TimelineClean() {
  const [doneSubs, setDoneSubs] = useState<Set<string>>(new Set(ROWS.flatMap((r) => r.subs.filter((s) => s.status === "done").map((s) => s.id))));
  const [selected, setSelected] = useState<Row | null>(null);

  function toggleSub(id: string) {
    setDoneSubs((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function completion(r: Row) {
    if (r.subs.length === 0) return r.status === "done" ? 1 : r.status === "in_progress" ? 0.5 : 0;
    return r.subs.filter((s) => doneSubs.has(s.id)).length / r.subs.length;
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white">
      {/* 월 축 */}
      <div className="flex items-center border-b border-gray-100">
        <div className="flex w-56 shrink-0 items-center px-4 py-3"><span className="text-xs font-medium text-gray-400">태스크</span></div>
        <div className="relative flex flex-1">{MONTHS.map((m) => <div key={m} className="flex-1 border-l border-gray-100 px-2 py-3 text-center text-xs font-medium text-gray-500">{m}</div>)}</div>
        <div className="w-20 shrink-0 px-2 text-center text-xs font-medium text-gray-400">하위</div>
      </div>

      {/* 메인 행만 */}
      {ROWS.map((row) => {
        const comp = completion(row);
        const p = Math.round(comp * 100);
        const st = comp === 1 ? "done" : comp > 0 ? "in_progress" : "todo";
        const doneCount = row.subs.filter((s) => doneSubs.has(s.id)).length;
        return (
          <div key={row.id} className="flex items-center border-b border-gray-50 hover:bg-gray-50/50">
            <button onClick={() => setSelected(row)} className="w-56 shrink-0 truncate px-4 py-3 text-left text-sm font-medium text-gray-900 hover:text-blue-600">{row.title}</button>
            <button onClick={() => setSelected(row)} className="relative block h-11 flex-1 cursor-pointer">
              <GridBg />
              <div className="absolute top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-md" style={{ left: `${pct(row.bar.start)}%`, width: `${pct(row.bar.end - row.bar.start + 1)}%` }}>
                <div className={`h-full w-full ${barBg[st]}`} />
                <div className={`absolute inset-y-0 left-0 ${fill[st]}`} style={{ width: `${p}%` }} />
                <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-medium text-gray-700">{p}%</span>
              </div>
            </button>
            <button onClick={() => setSelected(row)} className="flex w-20 shrink-0 items-center justify-center gap-1 px-2">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 tabular-nums">☑ {doneCount}/{row.subs.length}</span>
            </button>
          </div>
        );
      })}

      {/* 메인 추가 */}
      <div className="flex items-center border-b border-gray-50 px-4 py-2.5">
        <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          태스크 추가
        </span>
      </div>

      {/* 마일스톤 */}
      <div className="flex items-center bg-amber-50/40">
        <div className="flex w-56 shrink-0 items-center px-4 py-2.5"><span className="text-xs font-medium text-amber-700">마일스톤</span></div>
        <div className="relative h-10 flex-1">
          <GridBg />
          {MILESTONES.map((ms) => (
            <div key={ms.id} className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${pct(ms.at + 0.5)}%` }}>
              <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l9 9-9 9-9-9z" /></svg>
              <span className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-amber-700">{ms.title}</span>
            </div>
          ))}
        </div>
        <div className="w-20 shrink-0" />
      </div>

      {/* 슬라이드 패널: 설명 + 하위 태스크 체크리스트 */}
      <div className={`fixed inset-0 z-40 bg-black/20 transition-opacity ${selected ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => setSelected(null)} />
      <div className={`fixed inset-y-0 right-0 z-50 flex w-[420px] max-w-[90vw] flex-col bg-white shadow-2xl transition-transform duration-300 ${selected ? "translate-x-0" : "translate-x-full"}`}>
        {selected && (
          <>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusChip[selected.status]}`}>{statusLabel[selected.status]}</span>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <input defaultValue={selected.title} className="w-full text-lg font-semibold text-gray-900 focus:outline-none" />
              <div className="mt-5 flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-3"><span className="w-16 shrink-0 text-xs font-medium text-gray-400">담당자</span><span className="text-gray-700">{selected.assignee}</span></div>
                <div className="flex items-center gap-3"><span className="w-16 shrink-0 text-xs font-medium text-gray-400">기간</span><span className="text-gray-700">{MONTHS[selected.bar.start]} ~ {MONTHS[selected.bar.end]}</span></div>
                <div className="flex items-center gap-3"><span className="w-16 shrink-0 text-xs font-medium text-gray-400">우선순위</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${prioChip[selected.priority].cls}`}>{prioChip[selected.priority].label}</span></div>
              </div>

              <div className="mt-6">
                <p className="mb-2 text-xs font-medium text-gray-400">설명</p>
                <textarea rows={3} placeholder="설명을 입력하세요…" className="w-full resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none" />
              </div>

              {/* 하위 태스크 = 체크리스트 */}
              <div className="mt-6">
                <p className="mb-2 text-xs font-medium text-gray-400">하위 태스크 ({selected.subs.filter((s) => doneSubs.has(s.id)).length}/{selected.subs.length})</p>
                <div className="flex flex-col">
                  {selected.subs.map((sub) => {
                    const d = doneSubs.has(sub.id);
                    return (
                      <div key={sub.id} className="flex items-center gap-2.5 border-b border-gray-50 py-2">
                        <button onClick={() => toggleSub(sub.id)} className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border ${d ? "border-green-500 bg-green-500 text-white" : "border-gray-300 text-transparent hover:border-blue-400"}`}>
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        </button>
                        <span className={`flex-1 text-sm ${d ? "text-gray-400 line-through" : "text-gray-700"}`}>{sub.title}</span>
                        <span className="text-[11px] text-gray-400">{sub.due}</span>
                      </div>
                    );
                  })}
                  <button className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    하위 태스크 추가
                  </button>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 px-5 py-3"><button className="w-full rounded-lg bg-blue-500 py-2.5 text-sm font-medium text-white">저장</button></div>
          </>
        )}
      </div>
    </div>
  );
}
