"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { quickAddTask, updateTaskStatus, addMilestone, deleteMilestone } from "../actions";
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

export default function ProjectTimeline({ projectId, mainTasks, members, currentUserId, milestones }: {
  projectId: string; mainTasks: MainTask[]; members: Member[]; currentUserId: string; milestones: Milestone[];
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
  const pct = (i: number) => (i / N) * 100;

  const todayIdx = nowYm - minYm;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayPct = ((todayIdx + (now.getDate() - 1) / daysInMonth) / N) * 100;

  function span(startDate: string | null, dueDate: string | null) {
    let s = ymOf(startDate) ?? ymOf(dueDate) ?? nowYm;
    let e = ymOf(dueDate) ?? ymOf(startDate) ?? nowYm;
    let si = Math.max(0, Math.min(N - 1, s - minYm));
    let ei = Math.max(0, Math.min(N - 1, e - minYm));
    if (ei < si) ei = si;
    return { left: `calc(${pct(si)}% + 4px)`, width: `calc(${pct(ei - si + 1)}% - 8px)` };
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
        return (
          <div key={row.id}>
            <div className="group flex items-center transition-colors hover:bg-gray-50/40">
              <div className="flex w-60 shrink-0 items-center gap-2 px-5 py-3">
                <Check done={row.status === "done"} onClick={() => toggleDone(row)} />
                <button onClick={() => toggle(row.id)} className="shrink-0 text-gray-300 hover:text-gray-500">
                  {row.subtasks.length > 0 ? <svg className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg> : <span className="block w-4" />}
                </button>
                <button onClick={() => setSelected(row)} className={`truncate text-left text-sm font-medium hover:text-blue-600 ${isDone ? "text-gray-300 line-through" : "text-gray-900"}`}>{row.title}</button>
              </div>
              <button onClick={() => setSelected(row)} className="relative block h-12 flex-1 cursor-pointer">
                <Columns />
                <div className={`absolute top-1/2 flex h-7 -translate-y-1/2 items-center rounded-lg ring-1 ring-inset ${tn.ring} group-hover:ring-2`} style={span(row.startDate, row.dueDate)}>
                  <div className={`absolute inset-0 rounded-lg ${tn.soft}`} />
                  <div className={`absolute inset-y-0 left-0 rounded-lg ${tn.solid}`} style={{ width: `${pctV}%` }} />
                  <span className="relative z-10 ml-2.5 text-[11px] font-semibold text-gray-700">{pctV}%</span>
                  {row.assignees[0] && <span className="absolute -right-1 top-1/2 z-10 -translate-y-1/2"><Avatar a={row.assignees[0]} /></span>}
                </div>
              </button>
            </div>

            {isOpen && row.subtasks.length > 0 && (
              <div className="relative">
                <span className="pointer-events-none absolute left-[31px] top-0 bottom-3 w-px bg-gray-200" />
                {row.subtasks.map((sub) => {
                  const sDone = sub.status === "done";
                  return (
                    <div key={sub.id} className="group flex items-center hover:bg-gray-50/40">
                      <div className="flex w-60 shrink-0 items-center gap-2 py-2 pr-4 pl-[44px]">
                        <Check done={sDone} onClick={() => toggleDone(sub)} />
                        <button onClick={() => setSelected(sub)} className={`truncate text-left text-[13px] hover:text-blue-600 ${sDone ? "text-gray-300 line-through" : "text-gray-600"}`}>{sub.title}</button>
                      </div>
                      <button onClick={() => setSelected(sub)} className="relative block h-9 flex-1 cursor-pointer">
                        <Columns />
                        <div className={`absolute top-1/2 flex h-[18px] -translate-y-1/2 items-center rounded-md ${SUB_SOLID} group-hover:ring-2 ${SUB_RING}`} style={span(sub.startDate, sub.dueDate)}>
                          {sub.assignees[0] && <span className="absolute -right-0.5 top-1/2 -translate-y-1/2"><Avatar a={sub.assignees[0]} size="xs" /></span>}
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
        <div className="relative h-11 flex-1">
          <Columns />
          {milestones.map((ms) => {
            const lp = msPct(ms.date);
            const align = lp < 12 ? "translate-x-0" : lp > 88 ? "-translate-x-full" : "-translate-x-1/2";
            return (
            <div key={ms.id} className={`group absolute top-1/2 flex ${align} -translate-y-1/2 items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-1`} style={{ left: `${lp}%` }}>
              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l9 9-9 9-9-9z" /></svg>
              <span className="whitespace-nowrap text-[10px] font-semibold text-white">{ms.title}</span>
              <button onClick={() => { startTx(async () => { await deleteMilestone(ms.id, projectId); router.refresh(); }); }} className="ml-0.5 hidden text-white/80 hover:text-white group-hover:block"><svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
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
        <TaskDetailModal task={selected} projectId={projectId} allMembers={members} projectMembers={members} currentUserId={currentUserId} onClose={() => { setSelected(null); router.refresh(); }} />
      )}
    </div>
  );
}
