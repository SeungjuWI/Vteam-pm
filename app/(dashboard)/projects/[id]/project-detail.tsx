"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { updateTaskStatus, removeProjectMember } from "../actions";
import { useT } from "@/lib/i18n";
import type { Member, Task, Project, TaskStatus } from "./project-types";

const CreateTaskModal = dynamic(() => import("./create-task-modal"));
const EditProjectModal = dynamic(() => import("./edit-project-modal"));
const AddMemberModal = dynamic(() => import("./add-member-modal"));
const TaskDetailModal = dynamic(() => import("./task-detail-modal"));

interface Props {
  project: Project;
  members: Member[];
  allMembers: Member[];
  tasks: Task[];
  isManager: boolean;
  isMember: boolean;
  currentUserId: string;
}

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
  completed: { bg: "bg-green-50", text: "text-green-600", dot: "bg-green-500" },
  on_hold: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
};

const priorityConfig: Record<string, { label: string; bg: string; text: string }> = {
  high: { label: "High", bg: "bg-red-50", text: "text-red-500" },
  medium: { label: "Medium", bg: "bg-amber-50", text: "text-amber-600" },
  low: { label: "Low", bg: "bg-gray-100", text: "text-gray-500" },
};

function RemoveMemberButton({ projectId, memberId, onDone }: { projectId: string; memberId: string; onDone: () => void }) {
  const t = useT();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    if (!confirm(t("tasks.removeMemberConfirm"))) return;
    setLoading(true);
    await removeProjectMember(projectId, memberId);
    onDone();
  }

  return (
    <button onClick={handleRemove} disabled={loading} className="rounded-md p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  );
}

export default function ProjectDetail({ project, members, allMembers, tasks: initialTasks, isManager, isMember, currentUserId }: Props) {
  const t = useT();
  const canEdit = isMember || isManager;
  const sc = statusStyles[project.status] || statusStyles.active;
  const statusLabelMap: Record<string, string> = {
    active: t("projects.active"),
    completed: t("projects.completed"),
    on_hold: t("projects.onHold"),
  };

  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);
  const [showMembers, setShowMembers] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragTaskRef = useRef<string | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  function handleMouseDown(e: React.MouseEvent) {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
  }

  function handleDragStart(taskId: string) {
    dragTaskRef.current = taskId;
    isDragging.current = true;
  }

  function handleTaskClick(task: Task) {
    if (isDragging.current) return;
    setSelectedTask(task);
  }

  function handleDragOver(e: React.DragEvent, status: string) {
    e.preventDefault();
    setDragOverColumn(status);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  async function handleDrop(newStatus: TaskStatus) {
    setDragOverColumn(null);
    const taskId = dragTaskRef.current;
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    const result = await updateTaskStatus(taskId, newStatus, project.id);
    if (result?.error) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/projects" className="inline-flex w-fit items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {t("projects.backToList")}
      </Link>

      {/* 프로젝트 헤더 */}
      <div className="flex gap-5 rounded-2xl bg-white p-5">
        {project.imageUrl ? (
          <Image src={project.imageUrl} alt={project.name} width={128} height={128} className="h-32 w-32 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
            <svg className="h-10 w-10 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
        )}

        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 rounded-full ${sc.bg} px-2.5 py-0.5 text-[11px] font-medium ${sc.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                {statusLabelMap[project.status] || statusLabelMap.active}
              </span>
              {isManager && (
                <button onClick={() => setShowEdit(true)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                </button>
              )}
            </div>
            <h1 className="mt-2 text-xl font-semibold text-gray-900">{project.name}</h1>
            {project.description && <p className="mt-1 text-sm text-gray-500">{project.description}</p>}
          </div>

          <div className="relative mt-3 flex items-center gap-2">
            <button onClick={() => setShowMembers(!showMembers)} className="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-gray-50">
              {members.length > 0 ? (
                <>
                  <div className="flex -space-x-1.5">
                    {members.slice(0, 5).map((m) => (
                      <div key={m.id} className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
                        {m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : m.name[0]}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">{members.length}{t("projects.members")}</span>
                </>
              ) : (
                <span className="text-xs text-gray-400">{t("projects.noMembers")}</span>
              )}
            </button>

            {isManager && (
              <button onClick={() => setShowAddMember(true)} className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-500">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            )}

            {showMembers && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMembers(false)} />
                <div className="absolute top-full left-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white py-2">
                  <p className="px-4 pb-2 text-xs font-medium text-gray-400">{t("projects.participatingMembers")}</p>
                  {members.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">{t("projects.noParticipatingMembers")}</p>
                  ) : (
                    members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                            {m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" /> : m.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{m.name}</p>
                            <p className="text-[11px] text-gray-400">{m.position || m.email}</p>
                          </div>
                        </div>
                        {isManager && <RemoveMemberButton projectId={project.id} memberId={m.id} onDone={() => setShowMembers(false)} />}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 진행도 대시보드 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="flex flex-col gap-3 rounded-xl bg-white p-5">
          <p className="text-xs font-medium text-gray-500">{t("projects.progress")}</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-semibold text-gray-900">{progressPercent}</span>
            <span className="mb-1 text-sm text-gray-400">%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        {([
          { label: t("tasks.todo"), count: todoCount, dot: "bg-gray-400" },
          { label: t("tasks.inProgress"), count: inProgressCount, dot: "bg-blue-500" },
          { label: t("tasks.done"), count: doneCount, dot: "bg-green-500" },
        ] as const).map((item) => (
          <div key={item.label} className="flex flex-col gap-3 rounded-xl bg-white p-5">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.dot}`} />
              <p className="text-xs font-medium text-gray-500">{item.label}</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold text-gray-900">{item.count}</span>
              <span className="mb-1 text-sm text-gray-400">{t("tasks.count")}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 칸반 보드 */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t("tasks.title")}</h2>
        <div className="grid grid-cols-3 gap-4">
          {(["todo", "in_progress", "done"] as const).map((status) => {
            const labels = { todo: t("tasks.todo"), in_progress: t("tasks.inProgress"), done: t("tasks.done") };
            const dotColors = { todo: "bg-gray-400", in_progress: "bg-blue-500", done: "bg-green-500" };
            const statusTasks = tasks.filter((t) => t.status === status);
            const isOver = dragOverColumn === status;
            return (
              <div key={status} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <span className={`h-2 w-2 rounded-full ${dotColors[status]}`} />
                  <h3 className="text-sm font-medium text-gray-700">{labels[status]}</h3>
                  <span className="text-xs text-gray-400">{statusTasks.length}</span>
                </div>
                <div
                  onDragOver={canEdit ? (e) => handleDragOver(e, status) : undefined}
                  onDragLeave={canEdit ? handleDragLeave : undefined}
                  onDrop={canEdit ? () => handleDrop(status) : undefined}
                  className={`flex min-h-[160px] flex-col gap-2 rounded-xl p-3 transition-colors ${
                    isOver ? "bg-blue-50 ring-2 ring-blue-200" : "bg-white"
                  }`}
                >
                  {statusTasks.length === 0 ? (
                    canEdit ? (
                      <button
                        onClick={() => setShowCreateTask(status)}
                        className="m-auto flex flex-col items-center gap-1.5 text-gray-300 transition-colors hover:text-gray-400"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span className="text-xs">{isOver ? t("tasks.dropHere") : t("tasks.clickToAdd")}</span>
                      </button>
                    ) : (
                      <p className="m-auto text-xs text-gray-300">{t("tasks.noTasks")}</p>
                    )
                  ) : (
                    statusTasks.map((task) => {
                      const pc = priorityConfig[task.priority];
                      return (
                        <div
                          key={task.id}
                          draggable={canEdit}
                          onMouseDown={handleMouseDown}
                          onDragStart={canEdit ? () => handleDragStart(task.id) : undefined}
                          onClick={() => handleTaskClick(task)}
                          className={`cursor-pointer rounded-lg border border-gray-100 p-3 transition-colors hover:border-gray-200 ${canEdit ? "active:cursor-grabbing active:border-blue-200 active:bg-blue-50/50" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">{task.title}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${pc.bg} ${pc.text}`}>{pc.label}</span>
                          </div>
                          {task.description && (
                            <p className="mt-1 text-xs text-gray-400 line-clamp-1">{task.description}</p>
                          )}
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center">
                              {task.assignees.length > 0 && (
                                <div className="flex -space-x-1">
                                  {task.assignees.slice(0, 3).map((a, i) => (
                                    <div key={i} className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[8px] font-medium text-gray-500">
                                      {a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" /> : a.name[0]}
                                    </div>
                                  ))}
                                  {task.assignees.length > 3 && (
                                    <span className="ml-1 text-[10px] text-gray-400">+{task.assignees.length - 3}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            {task.dueDate && (
                              <span className="text-[11px] text-gray-400">
                                {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {canEdit && statusTasks.length > 0 && (
                    <button
                      onClick={() => setShowCreateTask(status)}
                      className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 py-2 text-xs text-gray-300 transition-colors hover:border-gray-300 hover:text-gray-400"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      {t("common.add")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 모달들 (dynamic import) */}
      {showEdit && <EditProjectModal project={project} onClose={() => setShowEdit(false)} />}
      {showAddMember && (
        <AddMemberModal projectId={project.id} currentMemberIds={members.map((m) => m.id)} allMembers={allMembers} onClose={() => setShowAddMember(false)} />
      )}
      {showCreateTask && (
        <CreateTaskModal projectId={project.id} initialStatus={showCreateTask} allMembers={allMembers} onClose={() => { setShowCreateTask(null); router.refresh(); }} />
      )}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectId={project.id}
          allMembers={allMembers}
          projectMembers={members}
          canEdit={canEdit}
          currentUserId={currentUserId}
          onClose={() => { setSelectedTask(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
