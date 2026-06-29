"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { updateTaskStatus, createTaskDraft } from "../actions";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import type { Member, Task, MainTask, TaskStatus } from "./project-types";
import { priorityConfig } from "./project-types";
// 클릭 즉시 떠야 하므로 일반 import (dynamic 지연 로딩이면 첫 클릭 때 청크 컴파일/다운로드로 멈칫함)
import TaskDetailModal from "./task-detail-modal";

export default function ProjectBoard({ projectId, mainTasks, members, allMembers, currentUserId }: {
  projectId: string; mainTasks: MainTask[]; members: Member[]; allMembers: Member[]; currentUserId: string;
}) {
  const t = useT();
  const router = useRouter();
  const [selected, setSelected] = useState<Task | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);

  // '추가' = 빈 태스크를 즉시 만들고 동일한 상세 편집기를 연다 (생성/편집 UI 통일)
  async function handleAddTask(status: TaskStatus) {
    const r = await createTaskDraft(projectId, null, status);
    if ("error" in r) { toast.error(r.error ?? ""); return; }
    setDraftId(r.task.id);
    setSelected(r.task);
  }
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const isDragging = useRef(false);

  const cols = [
    { key: "todo" as const, label: t("tasks.todo"), dot: "bg-slate-400" },
    { key: "in_progress" as const, label: t("tasks.inProgress"), dot: "bg-blue-500" },
    { key: "pending" as const, label: t("tasks.pending"), dot: "bg-amber-400" },
    { key: "done" as const, label: t("tasks.done"), dot: "bg-emerald-500" },
  ];

  async function handleDrop(status: TaskStatus) {
    setDragOver(null);
    const id = dragId.current;
    if (!id) return;
    const task = mainTasks.find((m) => m.id === id);
    if (!task || task.status === status) return;
    await updateTaskStatus(id, status, projectId);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cols.map((col) => {
        const cards = mainTasks.filter((m) => m.status === col.key);
        const over = dragOver === col.key;
        return (
          <div key={col.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              <h3 className="text-sm font-semibold text-gray-700">{col.label}</h3>
              <span className="text-xs text-gray-600">{cards.length}</span>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(col.key)}
              className={`flex min-h-[140px] flex-col gap-2 rounded-xl p-3 transition-colors ${over ? "bg-blue-50 ring-2 ring-blue-200" : "bg-white"}`}
            >
              {cards.map((task) => {
                const pc = priorityConfig[task.priority];
                const doneSubs = task.subtasks.filter((s) => s.status === "done").length;
                return (
                  <div key={task.id} draggable
                    onMouseDown={() => { isDragging.current = false; }}
                    onDragStart={() => { dragId.current = task.id; isDragging.current = true; }}
                    onClick={() => { if (!isDragging.current) setSelected(task); }}
                    className="cursor-pointer rounded-lg border border-gray-100 p-3 transition-colors hover:border-gray-200 active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${task.status === "done" ? "text-gray-400 line-through" : "text-gray-900"}`}>{task.title}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${pc.bg} ${pc.text}`}>{pc.label}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {task.assignees.length > 0 && (
                          <div className="flex -space-x-1">
                            {task.assignees.slice(0, 3).map((a, i) => (
                              <div key={i} className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[8px] font-medium text-gray-500 ring-1 ring-white">
                                {a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" /> : a.name[0]}
                              </div>
                            ))}
                          </div>
                        )}
                        {task.subtasks.length > 0 && <span className="text-[10px] text-gray-600">☑ {doneSubs}/{task.subtasks.length}</span>}
                      </div>
                      {task.dueDate && <span className="text-[11px] text-gray-600">{new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                    </div>
                  </div>
                );
              })}
              <button onClick={() => handleAddTask(col.key)} className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 py-2 text-xs text-gray-300 transition-colors hover:border-gray-300 hover:text-gray-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>{t("common.add")}
              </button>
            </div>
          </div>
        );
      })}

      {selected && (
        <TaskDetailModal task={selected} projectId={projectId} allMembers={allMembers} projectMembers={members} currentUserId={currentUserId} isDraft={selected.id === draftId} onClose={() => { setSelected(null); setDraftId(null); }} />
      )}
    </div>
  );
}
