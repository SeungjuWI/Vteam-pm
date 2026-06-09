"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { updateTaskStatus } from "../actions";
import { useT } from "@/lib/i18n";
import type { Member, MainTask, TaskStatus } from "./project-types";
import { priorityConfig } from "./project-types";

const TaskDetailModal = dynamic(() => import("./task-detail-modal"));
const CreateTaskModal = dynamic(() => import("./create-task-modal"));

export default function ProjectBoard({ projectId, mainTasks, members, currentUserId }: {
  projectId: string; mainTasks: MainTask[]; members: Member[]; currentUserId: string;
}) {
  const t = useT();
  const router = useRouter();
  const [selected, setSelected] = useState<MainTask | null>(null);
  const [showCreate, setShowCreate] = useState<TaskStatus | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const isDragging = useRef(false);

  const cols = [
    { key: "todo" as const, label: t("tasks.todo"), dot: "bg-slate-400" },
    { key: "in_progress" as const, label: t("tasks.inProgress"), dot: "bg-blue-500" },
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
    <div className="grid grid-cols-3 gap-4">
      {cols.map((col) => {
        const cards = mainTasks.filter((m) => m.status === col.key);
        const over = dragOver === col.key;
        return (
          <div key={col.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              <h3 className="text-sm font-medium text-gray-700">{col.label}</h3>
              <span className="text-xs text-gray-400">{cards.length}</span>
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
                        {task.subtasks.length > 0 && <span className="text-[10px] text-gray-400">☑ {doneSubs}/{task.subtasks.length}</span>}
                      </div>
                      {task.dueDate && <span className="text-[11px] text-gray-400">{new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setShowCreate(col.key)} className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 py-2 text-xs text-gray-300 transition-colors hover:border-gray-300 hover:text-gray-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>{t("common.add")}
              </button>
            </div>
          </div>
        );
      })}

      {showCreate && (
        <CreateTaskModal projectId={projectId} initialStatus={showCreate} allMembers={members} onClose={() => { setShowCreate(null); router.refresh(); }} />
      )}
      {selected && (
        <TaskDetailModal task={selected} projectId={projectId} allMembers={members} projectMembers={members} currentUserId={currentUserId} onClose={() => { setSelected(null); router.refresh(); }} />
      )}
    </div>
  );
}
