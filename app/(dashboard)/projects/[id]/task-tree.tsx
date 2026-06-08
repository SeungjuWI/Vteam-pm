"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { quickAddTask, updateTaskStatus } from "../actions";
import { useT } from "@/lib/i18n";
import type { Member, Task, MainTask } from "./project-types";
import { priorityConfig } from "./project-types";

const TaskDetailModal = dynamic(() => import("./task-detail-modal"));

export function mainCompletion(t: MainTask): number {
  if (t.subtasks.length > 0) {
    const done = t.subtasks.filter((s) => s.status === "done").length;
    return done / t.subtasks.length;
  }
  return t.status === "done" ? 1 : t.status === "in_progress" ? 0.5 : 0;
}

function Avatars({ assignees }: { assignees: Task["assignees"] }) {
  if (assignees.length === 0) return null;
  return (
    <div className="flex -space-x-1">
      {assignees.slice(0, 3).map((a, i) => (
        <div key={i} className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[8px] font-medium text-gray-500 ring-1 ring-white">
          {a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" /> : a.name[0]}
        </div>
      ))}
      {assignees.length > 3 && <span className="ml-1.5 self-center text-[10px] text-gray-400">+{assignees.length - 3}</span>}
    </div>
  );
}

/* 인라인 빠른 추가 입력 */
function QuickAdd({ projectId, parentId, placeholder, onDone }: {
  projectId: string; parentId: string | null; placeholder: string; onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    const title = value.trim();
    if (!title) { onDone(); return; }
    start(async () => {
      await quickAddTask(projectId, title, parentId, null);
      setValue("");
      router.refresh();
      onDone();
    });
  }

  return (
    <input
      autoFocus
      type="text"
      value={value}
      disabled={pending}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onDone(); }}
      onBlur={submit}
      placeholder={placeholder}
      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
    />
  );
}

/* 체크박스 */
function Checkbox({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
        done ? "border-green-500 bg-green-500 text-white" : "border-gray-300 text-transparent hover:border-blue-400"
      }`}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </button>
  );
}

export default function TaskTree({ projectId, mainTasks, members, currentUserId }: {
  projectId: string; mainTasks: MainTask[]; members: Member[]; currentUserId: string;
}) {
  const t = useT();
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(mainTasks.filter((m) => m.subtasks.length > 0).map((m) => m.id)));
  const [addingMain, setAddingMain] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [, startToggle] = useTransition();

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleDone(task: Task) {
    const next = task.status === "done" ? "todo" : "done";
    startToggle(async () => {
      await updateTaskStatus(task.id, next, projectId);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{t("tasks.mainTasks")}</h2>
        <button
          onClick={() => setAddingMain(true)}
          className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          {t("tasks.addMain")}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl bg-white">
        {mainTasks.length === 0 && !addingMain ? (
          <div className="flex flex-col items-center gap-2 py-12 text-gray-300">
            <p className="text-sm">{t("tasks.emptyMain")}</p>
          </div>
        ) : (
          mainTasks.map((main) => {
            const pc = priorityConfig[main.priority];
            const hasSubs = main.subtasks.length > 0;
            const doneSubs = main.subtasks.filter((s) => s.status === "done").length;
            const isOpen = expanded.has(main.id);
            const pct = Math.round(mainCompletion(main) * 100);
            return (
              <div key={main.id} className="border-b border-gray-50 last:border-b-0">
                {/* 메인 태스크 행 */}
                <div className="group flex items-center gap-2.5 px-4 py-3 hover:bg-gray-50/60">
                  {/* 펼침 토글 */}
                  <button
                    onClick={() => toggleExpand(main.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <svg className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>

                  {/* 리프(서브 없음)면 체크박스, 서브 있으면 진행률 링 */}
                  {hasSubs ? (
                    <span className="flex h-5 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[10px] font-medium text-gray-500 tabular-nums">
                      {doneSubs}/{main.subtasks.length}
                    </span>
                  ) : (
                    <Checkbox done={main.status === "done"} onToggle={() => toggleDone(main)} />
                  )}

                  {/* 제목 */}
                  <button onClick={() => setSelectedTask(main)} className="min-w-0 flex-1 text-left">
                    <span className={`text-sm font-medium ${pct === 100 ? "text-gray-400 line-through" : "text-gray-900"}`}>{main.title}</span>
                  </button>

                  {/* 진행률 바 */}
                  <div className="hidden w-24 items-center gap-2 sm:flex">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-7 text-right text-[11px] text-gray-400 tabular-nums">{pct}%</span>
                  </div>

                  {/* 우선순위 */}
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${pc.bg} ${pc.text}`}>{pc.label}</span>

                  {/* 담당자 */}
                  <div className="hidden w-14 justify-end sm:flex"><Avatars assignees={main.assignees} /></div>

                  {/* 마감일 */}
                  <span className="hidden w-12 shrink-0 text-right text-[11px] text-gray-400 sm:block">
                    {main.dueDate ? new Date(main.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                  </span>
                </div>

                {/* 서브 태스크들 */}
                {isOpen && (
                  <div className="bg-gray-50/40 pb-1 pl-11">
                    {main.subtasks.map((sub) => {
                      const spc = priorityConfig[sub.priority];
                      const sdone = sub.status === "done";
                      return (
                        <div key={sub.id} className="group flex items-center gap-2.5 py-2 pr-4 hover:bg-gray-50">
                          <Checkbox done={sdone} onToggle={() => toggleDone(sub)} />
                          <button onClick={() => setSelectedTask(sub)} className="min-w-0 flex-1 text-left">
                            <span className={`text-sm ${sdone ? "text-gray-400 line-through" : "text-gray-700"}`}>{sub.title}</span>
                          </button>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${spc.bg} ${spc.text}`}>{spc.label}</span>
                          <div className="hidden w-14 justify-end sm:flex"><Avatars assignees={sub.assignees} /></div>
                          <span className="hidden w-12 shrink-0 text-right text-[11px] text-gray-400 sm:block">
                            {sub.dueDate ? new Date(sub.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                          </span>
                        </div>
                      );
                    })}

                    {/* 서브 추가 */}
                    {addingSubFor === main.id ? (
                      <div className="py-1.5 pr-4">
                        <QuickAdd projectId={projectId} parentId={main.id} placeholder={t("tasks.subPlaceholder")} onDone={() => setAddingSubFor(null)} />
                      </div>
                    ) : (
                      <button
                        onClick={() => { setExpanded((p) => new Set(p).add(main.id)); setAddingSubFor(main.id); }}
                        className="flex items-center gap-1.5 py-2 text-xs text-gray-400 transition-colors hover:text-blue-500"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        {t("tasks.addSub")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* 메인 추가 인라인 */}
        {addingMain && (
          <div className="border-t border-gray-50 px-4 py-2.5">
            <QuickAdd projectId={projectId} parentId={null} placeholder={t("tasks.mainPlaceholder")} onDone={() => setAddingMain(false)} />
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectId={projectId}
          allMembers={members}
          projectMembers={members}
          currentUserId={currentUserId}
          onClose={() => { setSelectedTask(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
