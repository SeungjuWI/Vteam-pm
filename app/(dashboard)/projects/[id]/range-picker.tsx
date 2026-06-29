"use client";

import { useState, useRef, useEffect } from "react";

export type DateRange = { start: string; end: string };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtKo = (s: string) => { const d = parse(s); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// 사전설정 목록. 오늘(todayStr)과 데이터 전체범위(dataStart~dataEnd) 기준으로 계산.
function buildPresets(todayStr: string, dataStart: string, dataEnd: string): { label: string; range: DateRange }[] {
  const t = parse(todayStr);
  const y = t.getFullYear(), m = t.getMonth();
  const mStart = new Date(y, m, 1), mEnd = new Date(y, m + 1, 0);
  const qEnd = new Date(y, m + 3, 0); // 이번 달 ~ +2개월
  return [
    { label: "지난 30일", range: { start: ymd(addDays(t, -29)), end: ymd(t) } },
    { label: "지난 90일", range: { start: ymd(addDays(t, -89)), end: ymd(t) } },
    { label: "이번 달", range: { start: ymd(mStart), end: ymd(mEnd) } },
    { label: "이번 분기", range: { start: ymd(mStart), end: ymd(qEnd) } },
    { label: "올해", range: { start: `${y}-01-01`, end: `${y}-12-31` } },
    { label: "전체", range: { start: dataStart, end: dataEnd } },
  ];
}

const WD = ["월", "화", "수", "목", "금", "토", "일"];

export default function TimelineRangePicker({ value, todayStr, dataStart, dataEnd, onChange }: {
  value: DateRange; todayStr: string; dataStart: string; dataEnd: string; onChange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"preset" | "custom">("preset");
  const wrap = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const presets = buildPresets(todayStr, dataStart, dataEnd);
  const activePreset = presets.find((p) => p.range.start === value.start && p.range.end === value.end)?.label;

  // 커스텀 캘린더 상태
  const [pending, setPending] = useState<DateRange>(value);
  const [anchor, setAnchor] = useState<string | null>(null); // 시작점 클릭 후 종료 클릭 대기
  const [viewM, setViewM] = useState(() => parse(value.start));
  // 팝오버 열릴 때 현재 값으로 초기화
  useEffect(() => { if (open) { setPending(value); setAnchor(null); setViewM(parse(value.start)); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickDay(s: string) {
    if (!anchor) { setAnchor(s); setPending({ start: s, end: s }); }
    else {
      const lo = s < anchor ? s : anchor, hi = s < anchor ? anchor : s;
      setPending({ start: lo, end: hi }); setAnchor(null);
    }
  }

  // 보여줄 달력(월요일 시작, 6주 = 42칸)
  const first = new Date(viewM.getFullYear(), viewM.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -lead);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const inRange = (s: string) => s >= pending.start && s <= pending.end;

  return (
    <div ref={wrap} className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-blue-500 px-3.5 py-1.5 text-xs font-bold text-white transition-all duration-200 ease-spring hover:bg-blue-600 shadow-soft-sm active:scale-[0.98] hover:shadow-brand">
        <span>{fmtKo(value.start)} ~ {fmtKo(value.end)}</span>
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-2xl border border-gray-200 bg-white p-3">
          {/* 탭 */}
          <div className="mb-3 flex gap-0.5 rounded-xl bg-gray-100 p-0.5">
            {([["preset", "사전설정"], ["custom", "기간"]] as const).map(([k, ko]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${tab === k ? "bg-blue-500 text-white" : "text-gray-500 hover:text-gray-700"}`}>{ko}</button>
            ))}
          </div>

          {tab === "preset" ? (
            <div className="flex flex-col">
              {presets.map((p) => (
                <button key={p.label} onClick={() => { onChange(p.range); setOpen(false); }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gray-50">
                  <span className="flex items-center gap-1.5 text-sm text-gray-800">
                    <svg className={`h-3.5 w-3.5 text-blue-500 ${activePreset === p.label ? "" : "invisible"}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" /></svg>
                    {p.label}
                  </span>
                  <span className="text-xs text-gray-600">{fmtKo(p.range.start)} ~ {fmtKo(p.range.end)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div>
              {/* 선택된 시작/종료 표시 */}
              <div className="mb-2 flex gap-2">
                <div className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs">
                  <span className="text-gray-600">시작 </span><span className="font-medium text-gray-800">{fmtKo(pending.start)}</span>
                </div>
                <div className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs">
                  <span className="text-gray-600">종료 </span><span className="font-medium text-gray-800">{fmtKo(pending.end)}</span>
                </div>
              </div>
              {/* 월 네비게이션 */}
              <div className="mb-1 flex items-center justify-between px-1">
                <button onClick={() => setViewM(new Date(viewM.getFullYear(), viewM.getMonth() - 1, 1))} className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-[0.95]"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>
                <span className="text-sm font-semibold text-gray-800">{viewM.getFullYear()}년 {viewM.getMonth() + 1}월</span>
                <button onClick={() => setViewM(new Date(viewM.getFullYear(), viewM.getMonth() + 1, 1))} className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-[0.95]"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>
              </div>
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-0.5 px-1 py-1">
                {WD.map((w, i) => <span key={i} className="text-center text-[10px] font-medium text-gray-600">{w}</span>)}
              </div>
              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7 gap-0.5 px-1">
                {cells.map((d, i) => {
                  const s = ymd(d);
                  const other = d.getMonth() !== viewM.getMonth();
                  const sel = inRange(s);
                  const isEdge = s === pending.start || s === pending.end;
                  return (
                    <button key={i} onClick={() => pickDay(s)}
                      className={`h-8 rounded-md text-xs transition-colors ${isEdge ? "bg-blue-500 font-semibold text-white" : sel ? "bg-blue-50 text-blue-700" : other ? "text-gray-300 hover:bg-gray-50" : "text-gray-700 hover:bg-gray-100"}`}>
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
              {/* 적용/취소 */}
              <div className="mt-2 flex gap-2">
                <button onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-600 transition-all duration-200 ease-spring hover:bg-gray-200 shadow-soft-xs active:scale-[0.98]">취소</button>
                <button onClick={() => { onChange(pending); setOpen(false); }} className="flex-1 rounded-lg bg-blue-500 py-2 text-sm font-bold text-white transition-all duration-200 ease-spring hover:bg-blue-600 shadow-soft-sm active:scale-[0.98] hover:shadow-brand">적용</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
