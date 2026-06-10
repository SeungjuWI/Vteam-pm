"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { quickAddTask, updateTaskStatus, addMilestone, deleteMilestone, updateTaskDates, updateMilestoneDate } from "../actions";
import { useT } from "@/lib/i18n";
import type { Member, Task, MainTask, Milestone } from "./project-types";

const TaskDetailModal = dynamic(() => import("./task-detail-modal"));

const SUB_SOLID = "bg-slate-300";
const SUB_RING = "ring-slate-200";
const tone: Record<string, { soft: string; solid: string; ring: string }> = {
  done: { soft: "bg-emerald-100", solid: "bg-emerald-500", ring: "ring-emerald-200" },
  in_progress: { soft: "bg-blue-100", solid: "bg-blue-500", ring: "ring-blue-200" },
  todo: { soft: "bg-slate-100", solid: "bg-slate-300", ring: "ring-slate-200" },
};

function ymOf(d: string | null): number | null {
  if (!d) return null;
  const dt = new Date(d);
  return dt.getFullYear() * 12 + dt.getMonth();
}
function mainCompletion(t: MainTask): number {
  if (t.subtasks.length > 0) return t.subtasks.filter((s) => s.status === "done").length / t.subtasks.length;
  return t.status === "done" ? 1 : t.status === "in_progress" ? 0.5 : 0;
}

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

function QuickAdd({ projectId, parentId, placeholder, onDone }: { projectId: string; parentId: string | null; placeholder: string; onDone: () => void }) {
  const [v, setV] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  function submit() {
    const title = v.trim();
    if (!title) { onDone(); return; }
    start(async () => { await quickAddTask(projectId, title, parentId, null); setV(""); router.refresh(); onDone(); });
  }
  return <input autoFocus value={v} disabled={pending} onChange={(e) => setV(e.target.value)}
    onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onDone(); }} onBlur={submit}
    placeholder={placeholder} className="w-full rounded-lg border border-blue-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50" />;
}

export default function ProjectTimeline({ projectId, mainTasks, members, allMembers, currentUserId, milestones }: {
  projectId: string; mainTasks: MainTask[]; members: Member[]; allMembers: Member[]; currentUserId: string; milestones: Milestone[];
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState<Set<string>>(new Set(mainTasks.filter((m) => m.subtasks.length > 0).map((m) => m.id)));
  const [selected, setSelected] = useState<Task | null>(null);
  const [addingMain, setAddingMain] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [addingMs, setAddingMs] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msDate, setMsDate] = useState("");
  const [, startTx] = useTransition();

  // 드래그 상태 (막대/마일스톤 기간 조정)
  const [dragOverride, setDragOverride] = useState<{ id: string; startDate: string; dueDate: string } | null>(null);
  const [msOverride, setMsOverride] = useState<{ id: string; date: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<null | { kind: "task" | "ms"; mode: "move" | "l" | "r"; id: string; rect: DOMRect; anchorDay: number; origS: number; origE: number; latest?: { startDate?: string; dueDate?: string; date?: string } }>(null);
  const moved = useRef(false);
  useEffect(() => { setDragOverride(null); setMsOverride(null); }, [mainTasks, milestones]);

  function toggle(id: string) { setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleDone(task: Task) {
    const next = task.status === "done" ? "todo" : "done";
    startTx(async () => { await updateTaskStatus(task.id, next, projectId); router.refresh(); });
  }

  // 월 컬럼 범위 산출
  const now = new Date();
  const nowYm = now.getFullYear() * 12 + now.getMonth();
  const yms: number[] = [];
  for (const m of mainTasks) {
    for (const x of [ymOf(m.startDate), ymOf(m.dueDate)]) if (x !== null) yms.push(x);
    for (const s of m.subtasks) for (const x of [ymOf(s.startDate), ymOf(s.dueDate)]) if (x !== null) yms.push(x);
  }
  for (const ms of milestones) { const x = ymOf(ms.date); if (x !== null) yms.push(x); }
  const decYm = now.getFullYear() * 12 + 11; // 기본값: 올해 12월까지 표시
  const minYm = Math.min(nowYm, ...yms);
  const maxYm = Math.max(nowYm, decYm, ...yms);
  const N = maxYm - minYm + 1;
  const columns = Array.from({ length: N }, (_, i) => minYm + i);
  const label = (ym: number) => `${(ym % 12) + 1}월`;

  const todayIdx = nowYm - minYm;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayPct = ((todayIdx + (now.getDate() - 1) / daysInMonth) / N) * 100;

  function span(startDate: string | null, dueDate: string | null) {
    // 시작일 없으면 마감월 전체를 막대로(보이게), 있으면 일 단위 정밀
    const anchor = new Date(dueDate ?? startDate ?? todayStr);
    const ay = anchor.getFullYear(), am = anchor.getMonth();
    const monthStart = `${ay}-${pad(am + 1)}-01`;
    const monthEnd = `${ay}-${pad(am + 1)}-${pad(daysInM(ay, am))}`;
    const left = posOf(startDate ?? monthStart, false);
    const right = posOf(startDate ? (dueDate ?? startDate) : monthEnd, true);
    const width = Math.max(right - left, 3);
    return { left: `${left}%`, width: `${width}%` };
  }
  function msPct(date: string) {
    const dt = new Date(date);
    const ym = dt.getFullYear() * 12 + dt.getMonth();
    const dim = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    const idx = Math.max(0, Math.min(N - 1, ym - minYm));
    return ((idx + (dt.getDate() - 1) / dim) / N) * 100;
  }

  const Columns = () => (
    <div className="pointer-events-none absolute inset-0 flex">
      {columns.map((_, i) => <div key={i} className={`flex-1 border-r border-gray-100 last:border-r-0 ${i % 2 === 1 ? "bg-gray-50/50" : ""}`} />)}
    </div>
  );

  // ── 드래그 (일 단위) ──
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const daysInM = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();
  const ymToStartStr = (ym: number) => `${Math.floor(ym / 12)}-${pad((ym % 12) + 1)}-01`;
  const ymToEndStr = (ym: number) => { const y = Math.floor(ym / 12), mo = ym % 12; return `${y}-${pad(mo + 1)}-${pad(daysInM(y, mo))}`; };
  const posOf = (str: string, end: boolean) => {
    const dt = new Date(str); const y = dt.getFullYear(), m0 = dt.getMonth(), d = dt.getDate();
    const col = clamp(y * 12 + m0 - minYm, 0, N - 1);
    const dim = daysInM(y, m0);
    return ((col + (end ? d : d - 1) / dim) / N) * 100;
  };
  const dateAt = (clientX: number, rect: DOMRect) => {
    const frac = clamp((clientX - rect.left) / rect.width, 0, 0.999999);
    const colFloat = frac * N;
    const col = clamp(Math.floor(colFloat), 0, N - 1);
    const ym = minYm + col, y = Math.floor(ym / 12), m0 = ym % 12, dim = daysInM(y, m0);
    const day = clamp(Math.floor((colFloat - col) * dim) + 1, 1, dim);
    return `${y}-${pad(m0 + 1)}-${pad(day)}`;
  };
  const dayNum = (str: string) => { const dt = new Date(str); return Math.floor(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) / 86400000); };
  const fromDayNum = (n: number) => { const dt = new Date(n * 86400000); return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`; };
  const minDay = dayNum(ymToStartStr(minYm));
  const maxDay = dayNum(ymToEndStr(maxYm));
  const dsv = (task: { id: string; startDate: string | null }) => (dragOverride?.id === task.id ? dragOverride.startDate : task.startDate);
  const dev = (task: { id: string; dueDate: string | null }) => (dragOverride?.id === task.id ? dragOverride.dueDate : task.dueDate);
  const msDateOf = (ms: Milestone) => (msOverride?.id === ms.id ? msOverride.date : ms.date);

  // 메인 막대 = 하위 막대들의 전체 범위(합). 하위 없으면 자기 날짜.
  const rollupSpan = (row: MainTask) => {
    if (row.subtasks.length === 0) return span(dsv(row), dev(row));
    let minL = Infinity, maxR = -Infinity;
    for (const s of row.subtasks) {
      const sp = span(dsv(s), dev(s));
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
      drag.current = { kind, mode: "move", id: item.id, rect, anchorDay, origS: 0, origE: 0 };
    } else {
      let sd = dayNum(item.startDate ?? item.dueDate ?? todayStr);
      let ed = dayNum(item.dueDate ?? item.startDate ?? todayStr);
      if (ed < sd) { const tmp = sd; sd = ed; ed = tmp; }
      drag.current = { kind, mode, id: item.id, rect, anchorDay, origS: sd, origE: ed };
    }
    moved.current = false;
    setDragging(true);
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      const d = drag.current; if (!d) return;
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
      {/* 헤더 */}
      <div className="flex items-stretch border-b border-gray-100 bg-gray-50/30">
        <div className="flex w-60 shrink-0 items-end px-5 pb-3"><span className="text-xs font-medium text-gray-400">{t("tasks.mainTasks")}</span></div>
        <div className="relative flex flex-1 pt-7">
          {columns.map((ym, i) => (
            <div key={ym} className="flex-1 px-2 pb-3 text-center"><span className={`text-xs font-medium ${i === todayIdx ? "text-rose-500" : "text-gray-500"}`}>{label(ym)}</span></div>
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

      {mainTasks.length === 0 && !addingMain ? (
        <div className="py-12 text-center text-sm text-gray-300">{t("tasks.emptyMain")}</div>
      ) : mainTasks.map((row) => {
        const tn = tone[row.status];
        const isOpen = open.has(row.id);
        const isDone = mainCompletion(row) === 1;
        const pctV = Math.round(mainCompletion(row) * 100);
        const hasSubs = row.subtasks.length > 0;
        const barStyle = rollupSpan(row);
        return (
          <div key={row.id}>
            <div className="group flex items-center transition-colors hover:bg-gray-50/40">
              <div className="flex w-60 shrink-0 items-center gap-2 px-5 py-3">
                <Check done={row.status === "done"} onClick={() => toggleDone(row)} />
                <button onClick={() => toggle(row.id)} className="shrink-0 text-gray-300 hover:text-gray-500" title={t("tasks.addSub")}>
                  <svg className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </button>
                <button onClick={() => setSelected(row)} className={`truncate text-left text-sm font-medium hover:text-blue-600 ${isDone ? "text-gray-300 line-through" : "text-gray-900"}`}>{row.title}</button>
              </div>
              <button data-track onClick={() => { if (moved.current) { moved.current = false; return; } setSelected(row); }} className="relative block h-12 flex-1 cursor-pointer">
                <Columns />
                <div onMouseDown={hasSubs ? undefined : (e) => startDrag(e, "task", "move", row)} className={`absolute top-1/2 flex h-7 -translate-y-1/2 items-center rounded-lg ring-1 ring-inset ${tn.ring} group-hover:ring-2 ${hasSubs ? "" : "cursor-grab active:cursor-grabbing"}`} style={barStyle}>
                  <div className={`absolute inset-0 rounded-lg ${tn.soft}`} />
                  <div className={`absolute inset-y-0 left-0 rounded-lg ${tn.solid}`} style={{ width: `${pctV}%` }} />
                  {!hasSubs && <span onMouseDown={(e) => startDrag(e, "task", "l", row)} className="absolute left-0 top-0 z-20 h-full w-2 cursor-ew-resize rounded-l-lg" />}
                  <span className="relative z-10 ml-2.5 text-[11px] font-semibold text-gray-700">{pctV}%</span>
                  {row.assignees[0] && <span className="absolute -right-1 top-1/2 z-10 -translate-y-1/2"><Avatar a={row.assignees[0]} /></span>}
                  {!hasSubs && <span onMouseDown={(e) => startDrag(e, "task", "r", row)} className="absolute right-0 top-0 z-20 h-full w-2 cursor-ew-resize rounded-r-lg" />}
                </div>
              </button>
            </div>

            {isOpen && (
              <div className="relative">
                {row.subtasks.length > 0 && <span className="pointer-events-none absolute left-[31px] top-0 bottom-3 w-px bg-gray-200" />}
                {row.subtasks.map((sub) => {
                  const sDone = sub.status === "done";
                  return (
                    <div key={sub.id} className="group flex items-center hover:bg-gray-50/40">
                      <div className="flex w-60 shrink-0 items-center gap-2 py-2 pr-4 pl-[44px]">
                        <Check done={sDone} onClick={() => toggleDone(sub)} />
                        <button onClick={() => setSelected(sub)} className={`truncate text-left text-[13px] hover:text-blue-600 ${sDone ? "text-gray-300 line-through" : "text-gray-600"}`}>{sub.title}</button>
                      </div>
                      <button data-track onClick={() => { if (moved.current) { moved.current = false; return; } setSelected(sub); }} className="relative block h-9 flex-1 cursor-pointer">
                        <Columns />
                        <div onMouseDown={(e) => startDrag(e, "task", "move", sub)} className={`absolute top-1/2 flex h-[18px] -translate-y-1/2 cursor-grab items-center rounded-md ${SUB_SOLID} group-hover:ring-2 ${SUB_RING} active:cursor-grabbing`} style={span(dsv(sub), dev(sub))}>
                          <span onMouseDown={(e) => startDrag(e, "task", "l", sub)} className="absolute left-0 top-0 z-20 h-full w-1.5 cursor-ew-resize" />
                          {sub.assignees[0] && <span className="absolute -right-0.5 top-1/2 -translate-y-1/2"><Avatar a={sub.assignees[0]} size="xs" /></span>}
                          <span onMouseDown={(e) => startDrag(e, "task", "r", sub)} className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-ew-resize" />
                        </div>
                      </button>
                    </div>
                  );
                })}
                {addingSubFor === row.id ? (
                  <div className="py-1.5 pl-[44px] pr-4"><QuickAdd projectId={projectId} parentId={row.id} placeholder={t("tasks.subPlaceholder")} onDone={() => setAddingSubFor(null)} /></div>
                ) : (
                  <button onClick={() => { setOpen((p) => new Set(p).add(row.id)); setAddingSubFor(row.id); }} className="flex items-center gap-1.5 py-2 pl-[44px] text-xs text-gray-300 hover:text-blue-500">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>{t("tasks.addSub")}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 메인 추가 */}
      {addingMain ? (
        <div className="px-5 py-2.5"><QuickAdd projectId={projectId} parentId={null} placeholder={t("tasks.mainPlaceholder")} onDone={() => setAddingMain(false)} /></div>
      ) : (
        <button onClick={() => setAddingMain(true)} className="flex items-center gap-1.5 px-5 py-3 text-xs font-medium text-gray-400 hover:text-blue-500">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>{t("tasks.addMain")}
        </button>
      )}

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
        <TaskDetailModal task={selected} projectId={projectId} allMembers={allMembers} projectMembers={members} currentUserId={currentUserId} onClose={() => { setSelected(null); router.refresh(); }} />
      )}
    </div>
  );
}
