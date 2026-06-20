"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { updateTaskStatus, addMilestone, deleteMilestone, updateTaskDates, updateMilestoneDate, reorderTasks, reorderSubtasks, createTaskDraft } from "../actions";
import { useT } from "@/lib/i18n";
import type { Member, Task, MainTask, Milestone } from "./project-types";

const TaskDetailModal = dynamic(() => import("./task-detail-modal"));

// 상태별 막대 색 (차분하게). 진도율(%)만큼 그라데이션으로 채움.
const STATUS_FILL: Record<string, string> = {
  todo: "from-slate-300 to-slate-400",
  in_progress: "from-blue-300 to-blue-600",
  pending: "from-amber-300 to-amber-500",
  done: "from-emerald-300 to-emerald-500",
};
const STATUS_TRACK: Record<string, string> = {
  todo: "bg-slate-100",
  in_progress: "bg-blue-100",
  pending: "bg-amber-50",
  done: "bg-emerald-100",
};
const STATUS_RING: Record<string, string> = {
  todo: "ring-slate-200",
  in_progress: "ring-blue-200",
  pending: "ring-amber-200",
  done: "ring-emerald-200",
};
// 펜딩(멈춤) 빗금 패턴
const STRIPE = "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,.55) 4px, rgba(255,255,255,.55) 8px)";
const SUB_RING = "ring-slate-200";

// 진도율(%): 완료(done) 태스크는 progress 값과 무관하게 100%로 본다.
// (체크박스로 완료 처리하면 status만 done이 되고 progress는 0으로 남기 때문)
const effProgress = (s: { status: string; progress?: number | null }) =>
  s.status === "done" ? 100 : Math.max(0, Math.min(100, s.progress ?? 0));


function Avatar({ a, size = "sm" }: { a: { name: string; avatarUrl: string | null }; size?: "sm" | "xs" }) {
  const cls = size === "sm" ? "h-5 w-5 text-[9px]" : "h-4 w-4 text-[8px]";
  return <span className={`flex ${cls} items-center justify-center rounded-full bg-white font-medium text-gray-600 ring-2 ring-white`}>
    {a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={20} height={20} className="h-full w-full rounded-full object-cover" /> : a.name[0]}
  </span>;
}

function Check({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 text-transparent hover:border-blue-400"}`}>
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
    </button>
  );
}

export default function ProjectTimeline({ projectId, mainTasks, members, allMembers, currentUserId, milestones }: {
  projectId: string; mainTasks: MainTask[]; members: Member[]; allMembers: Member[]; currentUserId: string; milestones: Milestone[];
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState<Set<string>>(new Set(mainTasks.filter((m) => m.subtasks.length > 0).map((m) => m.id)));
  const [scale, setScale] = useState<"week" | "month" | "year">("month");
  const scaleKey = `vteam:timeline-scale:${projectId}`;
  useEffect(() => { try { const v = localStorage.getItem(scaleKey); if (v === "week" || v === "year") setScale(v); } catch {} }, [scaleKey]);
  const chooseScale = (v: "week" | "month" | "year") => { setScale(v); try { localStorage.setItem(scaleKey, v); } catch {} };
  const [selected, setSelected] = useState<Task | null>(null);
  // 대시보드 마감현황 등에서 ?task=<id>로 진입하면 해당 태스크 모달 자동 오픈 (최초 1회만 — 닫은 뒤 refresh로 재오픈되는 것 방지)
  const searchParams = useSearchParams();
  const deepLinkOpened = useRef(false);
  useEffect(() => {
    if (deepLinkOpened.current) return;
    const tid = searchParams.get("task");
    if (!tid) return;
    for (const m of mainTasks) {
      if (m.id === tid) { setSelected(m); deepLinkOpened.current = true; return; }
      const sub = m.subtasks.find((s) => s.id === tid);
      if (sub) { setSelected(sub); deepLinkOpened.current = true; return; }
    }
  }, [searchParams, mainTasks]);
  // 태스크 추가 모달: null=닫힘, parentId=null이면 메인 / 값이 있으면 그 메인의 서브
  const [draftId, setDraftId] = useState<string | null>(null);

  // '추가' = 빈 태스크를 즉시 만들고 동일한 상세 편집기를 연다 (생성/편집 UI 통일)
  async function handleAddTask(parentId: string | null) {
    const r = await createTaskDraft(projectId, parentId);
    if ("error" in r) { alert(r.error); return; }
    if (parentId) setOpen((p) => new Set(p).add(parentId));
    setDraftId(r.task.id);
    setSelected(r.task);
  }
  const [showDone, setShowDone] = useState(false);
  const [addingMs, setAddingMs] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msDate, setMsDate] = useState("");
  const [, startTx] = useTransition();

  // 드래그 상태 (막대/마일스톤 기간 조정)
  const [dragOverride, setDragOverride] = useState<{ id: string; startDate: string; dueDate: string } | null>(null);
  const [msOverride, setMsOverride] = useState<{ id: string; date: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<null | { kind: "task" | "ms"; mode: "move" | "l" | "r"; id: string; rect: DOMRect; anchorDay: number; downX: number; origS: number; origE: number; latest?: { startDate?: string; dueDate?: string; date?: string } }>(null);
  const moved = useRef(false);
  useEffect(() => { setDragOverride(null); setMsOverride(null); }, [mainTasks, milestones]);

  // 메인태스크 행 순서(드래그 정렬)
  const [order, setOrder] = useState(mainTasks);
  useEffect(() => { setOrder(mainTasks); }, [mainTasks]);
  const orderRef = useRef(order);
  orderRef.current = order;
  const rowDrag = useRef<string | null>(null);
  const [rowDragging, setRowDragging] = useState<string | null>(null);
  function onRowDragEnter(targetId: string) {
    const from = rowDrag.current;
    if (!from || from === targetId) return;
    setOrder((prev) => {
      const arr = [...prev];
      const fi = arr.findIndex((x) => x.id === from);
      const ti = arr.findIndex((x) => x.id === targetId);
      if (fi < 0 || ti < 0) return prev;
      const [m] = arr.splice(fi, 1);
      arr.splice(ti, 0, m);
      return arr;
    });
  }
  function onRowDragEnd() {
    rowDrag.current = null;
    setRowDragging(null);
    startTx(async () => { await reorderTasks(projectId, orderRef.current.map((i) => i.id)); router.refresh(); });
  }

  // 서브태스크 행 순서(드래그 정렬) — 같은 부모 안에서만
  const subDrag = useRef<{ parentId: string; id: string } | null>(null);
  const [subDragging, setSubDragging] = useState<string | null>(null);
  function onSubDragEnter(parentId: string, targetId: string) {
    const d = subDrag.current;
    if (!d || d.parentId !== parentId || d.id === targetId) return;
    setOrder((prev) => prev.map((row) => {
      if (row.id !== parentId) return row;
      const arr = [...row.subtasks];
      const fi = arr.findIndex((x) => x.id === d.id);
      const ti = arr.findIndex((x) => x.id === targetId);
      if (fi < 0 || ti < 0) return row;
      const [m] = arr.splice(fi, 1);
      arr.splice(ti, 0, m);
      return { ...row, subtasks: arr };
    }));
  }
  function onSubDragEnd(parentId: string) {
    subDrag.current = null;
    setSubDragging(null);
    const row = orderRef.current.find((r) => r.id === parentId);
    if (!row) return;
    const ids = row.subtasks.map((s) => s.id);
    startTx(async () => { await reorderSubtasks(projectId, parentId, ids); router.refresh(); });
  }

  function toggle(id: string) { setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  const expandableIds = mainTasks.filter((m) => m.subtasks.length > 0).map((m) => m.id);
  const allOpen = expandableIds.length > 0 && expandableIds.every((id) => open.has(id));
  function toggleAll() { setOpen(allOpen ? new Set() : new Set(expandableIds)); }

  // 펼침/접힘 상태를 프로젝트별로 localStorage에 저장·복원 (새로고침해도 유지)
  const storeKey = `vteam:timeline-open:${projectId}`;
  const skipSave = useRef(true);
  useEffect(() => {
    skipSave.current = true;
    try { const raw = localStorage.getItem(storeKey); if (raw) setOpen(new Set(JSON.parse(raw))); } catch {}
  }, [storeKey]);
  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return; }
    try { localStorage.setItem(storeKey, JSON.stringify([...open])); } catch {}
  }, [open, storeKey]);
  function toggleDone(task: Task) {
    const next = task.status === "done" ? "todo" : "done";
    startTx(async () => { await updateTaskStatus(task.id, next, projectId); router.refresh(); });
  }

  // ── 시간축 (주/월/연 전환) ──
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // 시작일이 지났는데 아직 시작 전(0%)이거나, 마감일이 지났는데 미완료 → 경고
  const isLate = (status: string, progress: number, startDate: string | null, dueDate: string | null) => {
    const lateStart = status === "todo" && (progress ?? 0) === 0 && !!startDate && Date.parse(startDate) < todayMid;
    const overdue = status !== "done" && !!dueDate && Date.parse(dueDate) < todayMid;
    return lateStart || overdue;
  };

  // 기본 날짜 헬퍼
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const pad = (n: number) => String(n).padStart(2, "0");
  const daysInM = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const dayNum = (str: string) => { const dt = new Date(str); return Math.floor(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) / 86400000); };
  const fromDayNum = (n: number) => { const dt = new Date(n * 86400000); return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`; };

  // 보기별 컬럼 단위: 주=일(日) 칸 / 월=주(週) 칸 / 연=월(月) 칸
  const utc = (day: number) => { const dt = new Date(day * 86400000); return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), dow: dt.getUTCDay() }; };
  const unitStart = (day: number) => {
    const { y, m, dow } = utc(day);
    if (scale === "week") return day;                            // 일 단위
    if (scale === "month") return day - ((dow + 6) % 7);         // 주(월요일 시작) 단위
    return Math.floor(Date.UTC(y, m, 1) / 86400000);            // 월 단위 (연 보기)
  };
  const unitNext = (day: number) => {
    const { y, m } = utc(day);
    if (scale === "week") return day + 1;
    if (scale === "month") return unitStart(day) + 7;
    return Math.floor(Date.UTC(y, m + 1, 1) / 86400000);
  };
  const unitLabel = (day: number) => {
    const { y, m, d } = utc(day);
    if (scale === "week") return d === 1 ? `${m + 1}/1` : `${d}`;  // 일: 날짜(월초엔 6/1)
    if (scale === "month") return `${m + 1}/${d}`;                 // 주: 그 주 월요일 날짜
    return m === 0 ? `${y}` : `${m + 1}월`;                        // 월: 1월엔 연도 표기
  };

  // 데이터 날짜 수집 → 축 범위(단위 경계로 스냅)
  const todayDay = dayNum(todayStr);
  const allDays = [todayDay];
  for (const mt of mainTasks) {
    for (const x of [mt.startDate, mt.dueDate]) if (x) allDays.push(dayNum(x));
    for (const s of mt.subtasks) for (const x of [s.startDate, s.dueDate]) if (x) allDays.push(dayNum(x));
  }
  for (const ms of milestones) if (ms.date) allDays.push(dayNum(ms.date));
  // 기본 표시 범위: 주(일 칸)=오늘부터 2주, 월(주 칸)=6주, 연(월 칸)=올해 말까지
  const defaultEnd = scale === "week" ? todayDay + 13
    : scale === "month" ? todayDay + 42
    : dayNum(`${now.getFullYear()}-12-31`);
  const axisStart = unitStart(Math.min(...allDays));
  const axisEnd = unitNext(Math.max(...allDays, defaultEnd));   // 제외(exclusive) 경계
  const totalDays = Math.max(1, axisEnd - axisStart);

  // 컬럼 목록(각 단위의 시작·끝 일수와 라벨)
  const columns: { start: number; end: number; label: string }[] = [];
  for (let c = axisStart; c < axisEnd; c = unitNext(c)) columns.push({ start: c, end: Math.min(unitNext(c), axisEnd), label: unitLabel(c) });
  const N = columns.length;

  // 날짜 → 축 위 좌표(%)
  const pctDay = (day: number, end: boolean) => ((clamp(day + (end ? 1 : 0), axisStart, axisEnd) - axisStart) / totalDays) * 100;
  const todayIdx = columns.findIndex((c) => todayDay >= c.start && todayDay < c.end);
  const todayPct = ((todayDay + 0.5 - axisStart) / totalDays) * 100;

  function span(startDate: string | null, dueDate: string | null) {
    let left: number, right: number;
    if (startDate) {
      left = pctDay(dayNum(startDate), false);
      right = pctDay(dayNum(dueDate ?? startDate), true);
    } else {
      // 시작일이 없으면 마감일이 속한 '한 칸'(주/월/연)을 막대로 표시
      const due = dayNum(dueDate ?? todayStr);
      left = pctDay(unitStart(due), false);
      right = pctDay(unitNext(due) - 1, true);
    }
    const width = Math.max(right - left, scale === "year" ? 0.8 : 2);
    return { left: `${left}%`, width: `${width}%` };
  }
  function msPct(date: string) { return ((dayNum(date) + 0.5 - axisStart) / totalDays) * 100; }

  const Columns = () => (
    <div className="pointer-events-none absolute inset-0 flex">
      {columns.map((c, i) => (
        <div key={i} style={{ width: `${((c.end - c.start) / totalDays) * 100}%` }} className={`relative border-r border-gray-100 last:border-r-0 ${i % 2 === 1 ? "bg-gray-50/50" : ""}`}>
          {/* 연 보기(월 칸)에선 칸을 4등분하는 옅은 주(週) 보조선 */}
          {scale === "year" && <>
            <span className="absolute inset-y-0 left-[25%] w-px bg-gray-100/80" />
            <span className="absolute inset-y-0 left-[50%] w-px bg-gray-100/80" />
            <span className="absolute inset-y-0 left-[75%] w-px bg-gray-100/80" />
          </>}
        </div>
      ))}
    </div>
  );

  // 드래그(마일스톤 이동)용 날짜 역산
  const dateAt = (clientX: number, rect: DOMRect) => {
    const frac = clamp((clientX - rect.left) / rect.width, 0, 0.999999);
    return fromDayNum(Math.floor(axisStart + frac * totalDays));
  };
  const minDay = axisStart;
  const maxDay = axisEnd - 1;
  const dsv = (task: { id: string; startDate: string | null }) => (dragOverride?.id === task.id ? dragOverride.startDate : task.startDate);
  const dev = (task: { id: string; dueDate: string | null }) => (dragOverride?.id === task.id ? dragOverride.dueDate : task.dueDate);
  const msDateOf = (ms: Milestone) => (msOverride?.id === ms.id ? msOverride.date : ms.date);

  // hover 툴팁용 날짜 포맷: "6/3 ~ 6/20 (18일)" / 단일일이면 "6/3"
  const fmtD = (s: string) => { const dt = new Date(s); return `${dt.getMonth() + 1}/${dt.getDate()}`; };
  const fmtRange = (start: string | null, due: string | null) => {
    if (!start && !due) return "기간 미설정";
    const s = start ?? due!, e = due ?? start!;
    if (s === e) return fmtD(s);
    const days = Math.abs(dayNum(e) - dayNum(s)) + 1;
    return `${fmtD(s)} ~ ${fmtD(e)} (${days}일)`;
  };
  // 메인(서브 보유) 막대 툴팁: 메인+서브 전체의 시작~마감 합집합 범위
  const rollupDates = (row: MainTask) => {
    let minS: string | null = null, maxD: string | null = null;
    for (const it of [{ s: dsv(row), d: dev(row) }, ...row.subtasks.map((x) => ({ s: dsv(x), d: dev(x) }))]) {
      const s = it.s ?? it.d, d = it.d ?? it.s;
      if (s && (!minS || s < minS)) minS = s;
      if (d && (!maxD || d > maxD)) maxD = d;
    }
    return { s: minS, d: maxD };
  };

  // 메인 막대 = 메인 자체 기간 ∪ 하위 막대들의 범위(합집합). 날짜 없는 하위는 제외.
  const rollupSpan = (row: MainTask) => {
    const spans: { left: string; width: string }[] = [];
    if (dsv(row) || dev(row)) spans.push(span(dsv(row), dev(row)));
    for (const s of row.subtasks) {
      if (dsv(s) || dev(s)) spans.push(span(dsv(s), dev(s)));
    }
    if (spans.length === 0) return span(dsv(row), dev(row));
    let minL = Infinity, maxR = -Infinity;
    for (const sp of spans) {
      const l = parseFloat(sp.left), w = parseFloat(sp.width);
      if (!isNaN(l) && !isNaN(w)) { minL = Math.min(minL, l); maxR = Math.max(maxR, l + w); }
    }
    if (minL === Infinity) return span(dsv(row), dev(row));
    return { left: `${minL}%`, width: `${maxR - minL}%` };
  };

  function startDrag(e: React.MouseEvent, kind: "task" | "ms", mode: "move" | "l" | "r", item: { id: string; startDate?: string | null; dueDate?: string | null }) {
    const trackEl = (e.currentTarget as HTMLElement).closest("[data-track]") as HTMLElement | null;
    if (!trackEl) return;
    e.preventDefault(); e.stopPropagation();
    const rect = trackEl.getBoundingClientRect();
    const anchorDay = dayNum(dateAt(e.clientX, rect));
    if (kind === "ms") {
      drag.current = { kind, mode: "move", id: item.id, rect, anchorDay, downX: e.clientX, origS: 0, origE: 0 };
    } else {
      let sd: number, ed: number;
      if (item.startDate) {
        // 시작·마감이 있으면 그대로
        sd = dayNum(item.startDate);
        ed = dayNum(item.dueDate ?? item.startDate);
      } else if (item.dueDate) {
        // 시작일이 없으면 화면엔 '마감월 전체'로 보임 → 그 폭을 유지(하루로 쪼그라들지 않게)
        const due = new Date(item.dueDate);
        const y = due.getFullYear(), m0 = due.getMonth();
        sd = dayNum(`${y}-${pad(m0 + 1)}-01`);
        ed = dayNum(`${y}-${pad(m0 + 1)}-${pad(daysInM(y, m0))}`);
      } else {
        sd = ed = dayNum(todayStr);
      }
      if (ed < sd) { const tmp = sd; sd = ed; ed = tmp; }
      drag.current = { kind, mode, id: item.id, rect, anchorDay, downX: e.clientX, origS: sd, origE: ed };
    }
    moved.current = false;
    setDragging(true);
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      const d = drag.current; if (!d) return;
      // 클릭과 드래그 구분: 4px 이상 움직여야 비로소 드래그로 인정(클릭만으론 막대 안 변함)
      if (!moved.current && Math.abs(e.clientX - d.downX) <= 4) return;
      moved.current = true;
      const cur = dayNum(dateAt(e.clientX, d.rect));
      if (d.kind === "ms") { const date = fromDayNum(cur); d.latest = { date }; setMsOverride({ id: d.id, date }); return; }
      let s = d.origS, en = d.origE;
      if (d.mode === "move") { const w = d.origE - d.origS; s = clamp(d.origS + (cur - d.anchorDay), minDay, maxDay - w); en = s + w; }
      else if (d.mode === "l") s = clamp(Math.min(cur, d.origE), minDay, d.origE);
      else if (d.mode === "r") en = clamp(Math.max(cur, d.origS), d.origS, maxDay);
      const startDate = fromDayNum(s), dueDate = fromDayNum(en);
      d.latest = { startDate, dueDate };
      setDragOverride({ id: d.id, startDate, dueDate });
    }
    function onUp() {
      const d = drag.current;
      drag.current = null;
      setDragging(false);
      if (!d || !moved.current || !d.latest) return;
      if (d.kind === "ms" && d.latest.date) {
        const date = d.latest.date;
        startTx(async () => { await updateMilestoneDate(d.id, projectId, date); router.refresh(); });
      } else if (d.latest.startDate && d.latest.dueDate) {
        const { startDate, dueDate } = d.latest;
        startTx(async () => { await updateTaskDates(d.id, projectId, startDate, dueDate); router.refresh(); });
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, minDay, maxDay, N, projectId, router]);

  async function submitMilestone() {
    if (!msTitle.trim() || !msDate) { setAddingMs(false); return; }
    await addMilestone(projectId, msTitle, msDate);
    setMsTitle(""); setMsDate(""); setAddingMs(false); router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      {/* 보기 단위 전환 (주/월/연) */}
      <div className="flex items-center justify-end border-b border-gray-100 px-4 py-2">
        <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5">
          {([["week", "주"], ["month", "월"], ["year", "연"]] as const).map(([v, ko]) => (
            <button key={v} onClick={() => chooseScale(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${scale === v ? "bg-white text-gray-900" : "text-gray-400 hover:text-gray-600"}`}>{ko}</button>
          ))}
        </div>
      </div>
      {/* 헤더 */}
      <div className="flex items-stretch border-b border-gray-100 bg-gray-50/30">
        <div className="flex w-60 shrink-0 items-end justify-between px-5 pb-3">
          <span className="text-xs font-medium text-gray-400">{t("tasks.mainTasks")}</span>
          {expandableIds.length > 0 && (
            <button onClick={toggleAll} title={allOpen ? "모두 접기" : "모두 펼치기"} className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-blue-500">
              <svg className={`h-3.5 w-3.5 transition-transform ${allOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              {allOpen ? "접기" : "펼치기"}
            </button>
          )}
        </div>
        <div className="relative flex flex-1 pt-7">
          {columns.map((c, i) => (
            <div key={i} style={{ width: `${((c.end - c.start) / totalDays) * 100}%` }} className="overflow-hidden px-1 pb-3 text-center"><span className={`text-xs font-medium ${i === todayIdx ? "text-rose-500" : "text-gray-500"}`}>{c.label}</span></div>
          ))}
          {todayIdx >= 0 && todayIdx < N && (
            <div className="pointer-events-none absolute top-1.5 z-20 flex -translate-x-1/2 flex-col items-center" style={{ left: `${todayPct}%` }}>
              <div className="flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5">
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.5l2.6 5.27 5.82.846-4.21 4.104.994 5.795L10 14.99l-5.204 2.735.994-5.795-4.21-4.104 5.82-.846z" /></svg>
                <span className="text-[9px] font-bold tracking-wide text-white">TODAY</span>
                <span className="text-[9px] font-semibold text-rose-100">{now.getMonth() + 1}/{now.getDate()}</span>
              </div>
              <span className="h-1.5 w-px bg-rose-400" />
            </div>
          )}
        </div>
      </div>

      {order.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-300">{t("tasks.emptyMain")}</div>
      ) : (() => {
        const isMainDone = (r: MainTask) => (r.subtasks.length > 0 ? r.subtasks.every((s) => s.status === "done") : r.status === "done");
        const renderMainRow = (row: MainTask) => {
        const isOpen = open.has(row.id);
        const subs = row.subtasks;
        const hasSubs = subs.length > 0;
        // 서브가 있으면 메인은 서브 집계로 표시 (진도 평균·상태·경고). 서브 없으면 메인 자체 값.
        const effStatus = hasSubs
          ? (subs.every((s) => s.status === "done") ? "done"
            : subs.some((s) => s.status === "pending") ? "pending"
            : subs.some((s) => s.status === "in_progress" || (s.progress ?? 0) > 0) ? "in_progress"
            : "todo")
          : row.status;
        const isDone = effStatus === "done";
        const pctV = hasSubs
          ? Math.round(subs.reduce((a, s) => a + effProgress(s), 0) / subs.length)
          : effProgress(row);
        const barStyle = rollupSpan(row);
        const warn = hasSubs
          ? subs.some((s) => isLate(s.status, s.progress ?? 0, s.startDate, s.dueDate))
          : isLate(row.status, pctV, row.startDate, row.dueDate);
        return (
          <div key={row.id}>
            <div onDragEnter={() => onRowDragEnter(row.id)} onDragOver={(e) => e.preventDefault()} className={`group flex items-center transition-colors hover:bg-gray-50/40 ${rowDragging === row.id ? "opacity-40" : ""}`}>
              <div className="flex w-60 shrink-0 items-center gap-1.5 px-3 py-3">
                <span draggable onDragStart={() => { rowDrag.current = row.id; setRowDragging(row.id); }} onDragEnd={onRowDragEnd} title="드래그로 순서 변경" className="shrink-0 cursor-grab text-gray-300 opacity-0 transition-all hover:text-gray-500 group-hover:opacity-100 active:cursor-grabbing">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><circle cx="7" cy="5" r="1.4" /><circle cx="7" cy="10" r="1.4" /><circle cx="7" cy="15" r="1.4" /><circle cx="13" cy="5" r="1.4" /><circle cx="13" cy="10" r="1.4" /><circle cx="13" cy="15" r="1.4" /></svg>
                </span>
                <Check done={isDone} onClick={() => { if (!hasSubs) toggleDone(row); }} />
                <button onClick={() => toggle(row.id)} className="shrink-0 text-gray-300 hover:text-gray-500" title={t("tasks.addSub")}>
                  <svg className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </button>
                {warn && <span title="시작일이 지났는데 시작 전이거나 마감이 지났어요" className="shrink-0 text-red-500"><svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg></span>}
                <button onClick={() => setSelected(row)} title={row.title} className={`truncate text-left text-sm font-medium hover:text-blue-600 ${isDone ? "text-gray-300 line-through" : warn ? "text-red-700" : "text-gray-900"}`}>{row.title}</button>
              </div>
              <button data-track onClick={() => setSelected(row)} className="relative block h-12 flex-1 cursor-pointer">
                <Columns />
                <div title={(() => { const r = rollupDates(row); return `${pctV}% · ${fmtRange(r.s, r.d)}`; })()} className={`absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-lg ${STATUS_TRACK[effStatus]} ring-inset group-hover:ring-2 ${warn ? "ring-2 ring-red-400" : `ring-1 ${STATUS_RING[effStatus]}`}`} style={barStyle}>
                  <div className={`absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r ${STATUS_FILL[effStatus]} transition-[width] duration-300`} style={{ width: `${pctV}%` }} />
                  {effStatus === "pending" && <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${pctV}%`, backgroundImage: STRIPE }} />}
                  <span className={`relative z-10 ml-2.5 text-[11px] font-semibold ${pctV >= 55 ? "text-white" : "text-gray-700"}`}>{pctV}%</span>
                  {row.assignees.length > 0 && <span className="absolute -right-1 top-1/2 z-10 flex -translate-y-1/2 -space-x-1.5">{row.assignees.slice(0, 3).map((a, i) => <Avatar key={i} a={a} />)}</span>}
                </div>
              </button>
            </div>

            {isOpen && (
              <div className="relative">
                {row.subtasks.length > 0 && <span className="pointer-events-none absolute left-[16px] top-0 bottom-3 w-px bg-gray-200" />}
                {row.subtasks.map((sub) => {
                  const sDone = sub.status === "done";
                  const subPct = effProgress(sub);
                  const subWarn = isLate(sub.status, subPct, sub.startDate, sub.dueDate);
                  return (
                    <div key={sub.id} onDragEnter={() => onSubDragEnter(row.id, sub.id)} onDragOver={(e) => e.preventDefault()} className={`group flex items-center hover:bg-gray-50/40 ${subDragging === sub.id ? "opacity-40" : ""}`}>
                      <div className="flex w-60 shrink-0 items-center gap-1.5 py-2 pr-4 pl-[26px]">
                        <span draggable onDragStart={() => { subDrag.current = { parentId: row.id, id: sub.id }; setSubDragging(sub.id); }} onDragEnd={() => onSubDragEnd(row.id)} title="드래그로 순서 변경" className="shrink-0 cursor-grab text-gray-300 opacity-0 transition-all hover:text-gray-500 group-hover:opacity-100 active:cursor-grabbing">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><circle cx="7" cy="5" r="1.4" /><circle cx="7" cy="10" r="1.4" /><circle cx="7" cy="15" r="1.4" /><circle cx="13" cy="5" r="1.4" /><circle cx="13" cy="10" r="1.4" /><circle cx="13" cy="15" r="1.4" /></svg>
                        </span>
                        <Check done={sDone} onClick={() => toggleDone(sub)} />
                        {subWarn && <span title="시작일이 지났는데 시작 전이거나 마감이 지났어요" className="shrink-0 text-red-500"><svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg></span>}
                        <button onClick={() => setSelected(sub)} title={sub.title} className={`truncate text-left text-[13px] hover:text-blue-600 ${sDone ? "text-gray-300 line-through" : subWarn ? "text-red-700" : "text-gray-600"}`}>{sub.title}</button>
                      </div>
                      <button data-track onClick={() => setSelected(sub)} className="relative block h-9 flex-1 cursor-pointer">
                        <Columns />
                        <div title={`${subPct}% · ${fmtRange(dsv(sub), dev(sub))}`} className={`absolute top-1/2 flex h-[18px] -translate-y-1/2 items-center overflow-hidden rounded-md ${STATUS_TRACK[sub.status]} ring-inset group-hover:ring-2 ${subWarn ? "ring-2 ring-red-400" : `ring-1 ${STATUS_RING[sub.status]}`}`} style={span(dsv(sub), dev(sub))}>
                          <div className={`absolute inset-y-0 left-0 rounded-md bg-gradient-to-r ${STATUS_FILL[sub.status]} transition-[width] duration-300`} style={{ width: `${subPct}%` }} />
                          {sub.status === "pending" && <div className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${subPct}%`, backgroundImage: STRIPE }} />}
                          {sub.assignees.length > 0 && <span className="absolute -right-0.5 top-1/2 flex -translate-y-1/2 -space-x-1.5">{sub.assignees.slice(0, 3).map((a, i) => <Avatar key={i} a={a} size="xs" />)}</span>}
                        </div>
                      </button>
                    </div>
                  );
                })}
                <button onClick={() => handleAddTask(row.id)} className="flex items-center gap-1.5 py-2 pl-[44px] text-xs text-gray-300 hover:text-blue-500">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>{t("tasks.addSub")}
                </button>
              </div>
            )}
          </div>
        );
        };
        const active = order.filter((r) => !isMainDone(r));
        const doneRows = order.filter((r) => isMainDone(r));
        return (
          <>
            {active.map(renderMainRow)}
            {doneRows.length > 0 && (
              <div className="border-t border-gray-100">
                <button onClick={() => setShowDone((v) => !v)} className="flex w-full items-center gap-1.5 px-5 py-2.5 text-xs font-medium text-gray-400 transition-colors hover:text-gray-600">
                  <svg className={`h-3.5 w-3.5 transition-transform ${showDone ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" /></svg>
                  {t("tasks.done")} {doneRows.length}
                </button>
                {showDone && doneRows.map(renderMainRow)}
              </div>
            )}
          </>
        );
      })()}

      {/* 메인 추가 */}
      <button onClick={() => handleAddTask(null)} className="flex items-center gap-1.5 px-5 py-3 text-xs font-medium text-gray-400 hover:text-blue-500">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>{t("tasks.addMain")}
      </button>

      {/* 마일스톤 */}
      <div className="flex items-center border-t border-gray-100 bg-amber-50/30">
        <div className="flex w-60 shrink-0 items-center gap-1.5 px-5 py-3">
          <svg className="h-3 w-3 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l9 9-9 9-9-9z" /></svg>
          <span className="text-xs font-medium text-amber-700">마일스톤</span>
          <button onClick={() => setAddingMs((v) => !v)} className="ml-1 text-amber-500 hover:text-amber-700"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>
        </div>
        <div data-track className="relative h-11 flex-1">
          <Columns />
          {milestones.map((ms) => {
            const d = msDateOf(ms);
            const lp = msPct(d);
            const dt = new Date(d);
            const onRight = lp > 72;
            return (
            <div key={ms.id} onMouseDown={(e) => startDrag(e, "ms", "move", ms)}
              className={`group absolute top-1/2 z-10 flex -translate-y-1/2 cursor-grab items-center gap-1 active:cursor-grabbing ${onRight ? "-translate-x-full flex-row-reverse" : ""}`}
              style={{ left: `${lp}%` }}>
              {/* 다이아몬드 = 정확한 날짜 지점 */}
              <svg className={`h-3 w-3 shrink-0 text-amber-500 ${onRight ? "translate-x-1/2" : "-translate-x-1/2"}`} viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l9 9-9 9-9-9z" /></svg>
              <span className="whitespace-nowrap rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-white">{ms.title} · {dt.getMonth() + 1}/{dt.getDate()}</span>
              <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); startTx(async () => { await deleteMilestone(ms.id, projectId); router.refresh(); }); }} className="hidden text-amber-400 hover:text-amber-600 group-hover:block"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            );
          })}
        </div>
      </div>
      {addingMs && (
        <div className="flex items-center gap-2 border-t border-gray-100 bg-amber-50/20 px-5 py-2.5">
          <input value={msTitle} onChange={(e) => setMsTitle(e.target.value)} placeholder="마일스톤 이름" className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
          <input type="date" value={msDate} onChange={(e) => setMsDate(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
          <button onClick={submitMilestone} className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500">추가</button>
        </div>
      )}

      {selected && (
        <TaskDetailModal task={selected} projectId={projectId} allMembers={allMembers} projectMembers={members} currentUserId={currentUserId} isDraft={selected.id === draftId} onClose={() => { setSelected(null); setDraftId(null); }} />
      )}
    </div>
  );
}
