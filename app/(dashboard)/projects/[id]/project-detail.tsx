"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateProject, addProjectMember, removeProjectMember, createTask, updateTaskStatus, updateTask, deleteTask, getTaskComments, createTaskComment, deleteTaskComment } from "../actions";
import { compressImage } from "@/lib/compress-image";

interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  position: string | null;
}

interface TaskAssignee {
  name: string;
  avatarUrl: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  assignees: TaskAssignee[];
  dueDate: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: string;
  createdAt: string;
}

interface Props {
  project: Project;
  members: Member[];
  allMembers: Member[];
  tasks: Task[];
  isManager: boolean;
  isMember: boolean;
  currentUserId: string;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: "진행 중", bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
  completed: { label: "완료", bg: "bg-green-50", text: "text-green-600", dot: "bg-green-500" },
  on_hold: { label: "보류", bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
};

const priorityConfig: Record<string, { label: string; bg: string; text: string }> = {
  high: { label: "High", bg: "bg-red-50", text: "text-red-500" },
  medium: { label: "Medium", bg: "bg-amber-50", text: "text-amber-600" },
  low: { label: "Low", bg: "bg-gray-100", text: "text-gray-500" },
};

type TaskStatus = "todo" | "in_progress" | "done";

export default function ProjectDetail({ project, members, allMembers, tasks: initialTasks, isManager, isMember, currentUserId }: Props) {
  // 태스크 추가/드래그: 프로젝트 멤버 또는 관리자
  const canEdit = isMember || isManager;
  const sc = statusConfig[project.status] || statusConfig.active;

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

  // 드래그 앤 드롭 + 클릭 구분
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

    // 낙관적 업데이트
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    const result = await updateTaskStatus(taskId, newStatus, project.id);
    if (result?.error) {
      // 롤백
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 뒤로가기 */}
      <Link href="/projects" className="inline-flex w-fit items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        프로젝트 목록
      </Link>

      {/* 프로젝트 헤더 */}
      <div className="flex gap-5 rounded-2xl bg-white p-5">
        {project.imageUrl ? (
          <img src={project.imageUrl} alt={project.name} className="h-32 w-32 shrink-0 rounded-xl object-cover" />
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
                {sc.label}
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
                        {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : m.name[0]}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">{members.length}명 참여</span>
                </>
              ) : (
                <span className="text-xs text-gray-400">참여 멤버 없음</span>
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
                  <p className="px-4 pb-2 text-xs font-medium text-gray-400">참여 멤버</p>
                  {members.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">참여 멤버가 없습니다</p>
                  ) : (
                    members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                            {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : m.name[0]}
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
          <p className="text-xs font-medium text-gray-500">프로젝트 진행률</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-semibold text-gray-900">{progressPercent}</span>
            <span className="mb-1 text-sm text-gray-400">%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        {([
          { label: "할 일", count: todoCount, dot: "bg-gray-400" },
          { label: "진행 중", count: inProgressCount, dot: "bg-blue-500" },
          { label: "완료", count: doneCount, dot: "bg-green-500" },
        ] as const).map((item) => (
          <div key={item.label} className="flex flex-col gap-3 rounded-xl bg-white p-5">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.dot}`} />
              <p className="text-xs font-medium text-gray-500">{item.label}</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold text-gray-900">{item.count}</span>
              <span className="mb-1 text-sm text-gray-400">개</span>
            </div>
          </div>
        ))}
      </div>

      {/* 칸반 보드 */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-900">태스크</h2>
        <div className="grid grid-cols-3 gap-4">
          {(["todo", "in_progress", "done"] as const).map((status) => {
            const labels = { todo: "할 일", in_progress: "진행 중", done: "완료" };
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
                        <span className="text-xs">{isOver ? "여기에 놓기" : "클릭하여 추가"}</span>
                      </button>
                    ) : (
                      <p className="m-auto text-xs text-gray-300">태스크 없음</p>
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
                                      {a.avatarUrl ? <img src={a.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" /> : a.name[0]}
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
                                {new Date(task.dueDate).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
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
                      추가
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 모달들 */}
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

/* ── 태스크 생성 모달 ── */
function CreateTaskModal({ projectId, initialStatus, allMembers, onClose }: { projectId: string; initialStatus: TaskStatus; allMembers: Member[]; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = allMembers.filter(
    (m) => !selectedIds.includes(m.id) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleSubmit() {
    setLoading(true);
    setError("");
    const result = await createTask(projectId, title, description, priority, dueDate, selectedIds, initialStatus);
    if (result?.error) { setError(result.error); setLoading(false); }
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">태스크 추가</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* 제목 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">제목 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="태스크 제목"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* 작업 내용 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">작업 내용</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="작업에 대해 설명해주세요"
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* 우선순위 + 마감일 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">우선순위</label>
              <div className="flex gap-1.5">
                {([
                  { key: "low", label: "Low", active: "bg-gray-100 text-gray-700" },
                  { key: "medium", label: "Medium", active: "bg-amber-50 text-amber-700" },
                  { key: "high", label: "High", active: "bg-red-50 text-red-600" },
                ] as const).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPriority(p.key)}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                      priority === p.key ? p.active : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">마감일</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 담당자 (복수) */}
          <div className="relative">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">담당자</label>
            {selectedIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedIds.map((mid) => {
                  const m = allMembers.find((member) => member.id === mid);
                  if (!m) return null;
                  return (
                    <span key={mid} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pr-2 pl-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-medium text-blue-600">
                        {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" /> : m.name[0]}
                      </span>
                      <span className="text-xs font-medium text-blue-700">{m.name}</span>
                      <button type="button" onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== mid))} className="text-blue-400 hover:text-blue-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder={selectedIds.length > 0 ? "추가 검색..." : "이름 또는 이메일로 검색"}
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-[5]" onClick={() => setShowDropdown(false)} />
                <div className="absolute top-full left-0 z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1">
                  {filtered.length === 0 ? (
                    <p className="px-3.5 py-2 text-sm text-gray-400">
                      {allMembers.length === selectedIds.length ? "모든 멤버 선택됨" : "검색 결과 없음"}
                    </p>
                  ) : (
                    filtered.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setSelectedIds((prev) => [...prev, m.id]); setSearch(""); setShowDropdown(false); searchRef.current?.focus(); }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-gray-50"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                          {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : m.name[0]}
                        </div>
                        <div>
                          <p className="text-sm text-gray-900">{m.name}</p>
                          <p className="text-[11px] text-gray-400">{m.position || m.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="mt-1 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
              취소
            </button>
            <button onClick={handleSubmit} disabled={loading} className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50">
              {loading ? "생성 중..." : "태스크 생성"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 프로젝트 수정 모달 ── */
function EditProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(project.imageUrl);
  const [removeImage, setRemoveImage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const compressedRef = useRef<File | null>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { blob, dataUrl } = await compressImage(file, 1200);
      compressedRef.current = new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: blob.type });
      setPreview(dataUrl);
      setRemoveImage(false);
    } catch {
      setError("이미지를 불러올 수 없습니다");
    }
  }

  function handleRemoveImage() {
    setPreview(null);
    setRemoveImage(true);
    compressedRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    formData.set("projectId", project.id);
    if (compressedRef.current) formData.set("image", compressedRef.current);
    if (removeImage) formData.set("removeImage", "true");
    const result = await updateProject(formData);
    if (result?.error) { setError(result.error); setLoading(false); }
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">프로젝트 수정</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">프로젝트 이미지</label>
            {preview ? (
              <div className="relative inline-block">
                <img src={preview} alt="" className="h-20 w-20 rounded-xl object-cover" />
                <button type="button" onClick={handleRemoveImage} className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-gray-300 text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-500">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
              </button>
            )}
            <input ref={fileRef} type="file" name="image" accept="image/*" onChange={handleImageChange} className="hidden" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">프로젝트 이름 <span className="text-red-400">*</span></label>
            <input type="text" name="name" defaultValue={project.name} required className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">설명</label>
            <textarea name="description" defaultValue={project.description || ""} rows={3} className="w-full resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">취소</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50">{loading ? "저장 중..." : "저장"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── 멤버 추가 모달 ── */
function AddMemberModal({ projectId, currentMemberIds, allMembers, onClose }: { projectId: string; currentMemberIds: string[]; allMembers: Member[]; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const available = allMembers.filter(
    (m) => !currentMemberIds.includes(m.id) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleAdd(memberId: string) {
    setLoading(memberId);
    const result = await addProjectMember(projectId, memberId);
    if (result?.error) alert(result.error);
    else onClose();
    setLoading(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">멤버 추가</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름 또는 이메일로 검색" className="mb-3 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none" autoFocus />
        <div className="max-h-64 overflow-y-auto">
          {available.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">{allMembers.length === currentMemberIds.length ? "모든 멤버가 참여 중입니다" : "검색 결과 없음"}</p>
          ) : (
            available.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : m.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.name}</p>
                    <p className="text-[11px] text-gray-400">{m.position || m.email}</p>
                  </div>
                </div>
                <button onClick={() => handleAdd(m.id)} disabled={loading === m.id} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50">
                  {loading === m.id ? "추가 중..." : "추가"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 멤버 제거 버튼 ── */
function RemoveMemberButton({ projectId, memberId, onDone }: { projectId: string; memberId: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    if (!confirm("이 멤버를 프로젝트에서 제거하시겠습니까?")) return;
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

/* ── 태스크 상세/수정 모달 ── */
function TaskDetailModal({ task, projectId, allMembers, projectMembers, canEdit, currentUserId, onClose }: {
  task: Task; projectId: string; allMembers: Member[]; projectMembers: Member[]; canEdit: boolean; currentUserId: string; onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  // 수정 폼 state
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [selectedIds, setSelectedIds] = useState<string[]>(
    allMembers.filter((m) => task.assignees.some((a) => a.name === m.name)).map((m) => m.id)
  );
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = allMembers.filter(
    (m) => !selectedIds.includes(m.id) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()))
  );

  const statusLabels: Record<string, string> = { todo: "할 일", in_progress: "진행 중", done: "완료" };
  const statusDots: Record<string, string> = { todo: "bg-gray-400", in_progress: "bg-blue-500", done: "bg-green-500" };
  const statusChips: Record<string, string> = { todo: "bg-gray-100 text-gray-600", in_progress: "bg-blue-50 text-blue-600", done: "bg-green-50 text-green-600" };
  const pc = priorityConfig[task.priority];

  async function handleSave() {
    setLoading(true);
    setError("");
    const result = await updateTask(task.id, projectId, title, description, priority, dueDate, selectedIds);
    if (result?.error) { setError(result.error); setLoading(false); }
    else onClose();
  }

  async function handleDelete() {
    if (!confirm("이 태스크를 삭제하시겠습니까?")) return;
    setDeleting(true);
    const result = await deleteTask(task.id, projectId);
    if (result?.error) { alert(result.error); setDeleting(false); }
    else onClose();
  }

  // 보기 모드
  if (!editing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="relative flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full ${statusChips[task.status]} px-2.5 py-0.5 text-xs font-medium`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusDots[task.status]}`} />
                {statusLabels[task.status]}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pc.bg} ${pc.text}`}>{pc.label}</span>
            </div>
            {canEdit && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute top-full right-0 z-20 mt-1 w-28 rounded-lg border border-gray-200 bg-white py-1">
                      <button onClick={() => { setShowMenu(false); setEditing(true); }} className="w-full px-3.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                        수정
                      </button>
                      <button onClick={() => { setShowMenu(false); handleDelete(); }} disabled={deleting} className="w-full px-3.5 py-2 text-left text-sm text-red-500 hover:bg-red-50 disabled:opacity-50">
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
          {/* 제목 + 정보 */}
          <div className="px-6 pt-5">
            <h2 className="text-lg font-semibold text-gray-900">{task.title}</h2>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 w-16 shrink-0 text-xs font-medium text-gray-400">담당자</span>
                {task.assignees.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {task.assignees.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 py-1 pr-2.5 pl-1">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
                          {a.avatarUrl ? <img src={a.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" /> : a.name[0]}
                        </span>
                        <span className="text-xs font-medium text-gray-700">{a.name}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-gray-300">-</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs font-medium text-gray-400">마감일</span>
                <span className="text-sm text-gray-700">
                  {task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
                    : "-"}
                </span>
              </div>
            </div>
          </div>

          {/* 본문 */}
          <div className="px-6 pb-3 pt-5">
            <p className="mb-2 text-xs font-medium text-gray-400">내용</p>
            {task.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{task.description}</p>
            ) : (
              <p className="text-sm text-gray-300">작업 내용 없음</p>
            )}
          </div>

          {/* 댓글 목록 */}
          <TaskCommentList
            taskId={task.id}
            projectMembers={projectMembers}
            currentUserId={currentUserId}
            projectId={projectId}
          />
          </div>

          {/* 댓글 입력 - 하단 고정 */}
          <TaskCommentInput
            taskId={task.id}
            projectId={projectId}
            projectMembers={projectMembers}
          />
        </div>
      </div>
    );
  }

  // 수정 모드
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">태스크 수정</h2>
          <button onClick={() => setEditing(false)} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">제목 <span className="text-red-400">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">작업 내용</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">우선순위</label>
              <div className="flex gap-1.5">
                {([
                  { key: "low", label: "Low", active: "bg-gray-100 text-gray-700" },
                  { key: "medium", label: "Medium", active: "bg-amber-50 text-amber-700" },
                  { key: "high", label: "High", active: "bg-red-50 text-red-600" },
                ] as const).map((p) => (
                  <button key={p.key} type="button" onClick={() => setPriority(p.key)} className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${priority === p.key ? p.active : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">마감일</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>

          {/* 담당자 */}
          <div className="relative">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">담당자</label>
            {selectedIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedIds.map((mid) => {
                  const m = allMembers.find((member) => member.id === mid);
                  if (!m) return null;
                  return (
                    <span key={mid} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pr-2 pl-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-medium text-blue-600">
                        {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" /> : m.name[0]}
                      </span>
                      <span className="text-xs font-medium text-blue-700">{m.name}</span>
                      <button type="button" onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== mid))} className="text-blue-400 hover:text-blue-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder={selectedIds.length > 0 ? "추가 검색..." : "이름 또는 이메일로 검색"}
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-[5]" onClick={() => setShowDropdown(false)} />
                <div className="absolute top-full left-0 z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1">
                  {filtered.length === 0 ? (
                    <p className="px-3.5 py-2 text-sm text-gray-400">검색 결과 없음</p>
                  ) : (
                    filtered.map((m) => (
                      <button key={m.id} type="button" onClick={() => { setSelectedIds((prev) => [...prev, m.id]); setSearch(""); setShowDropdown(false); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-gray-50">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                          {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : m.name[0]}
                        </div>
                        <div>
                          <p className="text-sm text-gray-900">{m.name}</p>
                          <p className="text-[11px] text-gray-400">{m.position || m.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
              취소
            </button>
            <button onClick={handleSave} disabled={loading} className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50">
              {loading ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 댓글 목록 (스크롤 영역 안) ── */
interface Comment {
  id: string;
  content: string;
  authorName: string;
  authorAvatarUrl: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

function renderContent(content: string) {
  return content.split(/(@\S+)/g).map((part, i) =>
    part.startsWith("@") ? <span key={i} className="font-medium text-blue-500">{part}</span> : part
  );
}

function TaskCommentList({ taskId, projectMembers, currentUserId, projectId }: {
  taskId: string; projectMembers: Member[]; currentUserId: string; projectId: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTaskComments(taskId).then((data) => { setComments(data); setLoaded(true); });
  }, [taskId]);

  useEffect(() => {
    if (loaded) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length, loaded]);

  // 댓글 추가 이벤트 수신
  useEffect(() => {
    function handler() {
      getTaskComments(taskId).then(setComments);
    }
    window.addEventListener(`comment-refresh-${taskId}`, handler);
    return () => window.removeEventListener(`comment-refresh-${taskId}`, handler);
  }, [taskId]);

  async function handleDelete(commentId: string) {
    await deleteTaskComment(commentId, projectId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  return (
    <div className="border-t border-gray-100 px-6 py-4">
      <p className="mb-3 text-xs font-medium text-gray-400">댓글 {comments.length > 0 && comments.length}</p>
      {!loaded ? (
        <p className="py-4 text-center text-xs text-gray-300">불러오는 중...</p>
      ) : comments.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-300">아직 댓글이 없습니다</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => {
            const isMine = projectMembers.some((m) => m.name === c.authorName && m.id === currentUserId);
            return (
              <div key={c.id} className="group flex gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
                  {c.authorAvatarUrl ? <img src={c.authorAvatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : c.authorName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-900">{c.authorName}</span>
                    <span className="text-[11px] text-gray-400">{timeAgo(c.createdAt)}</span>
                    {isMine && (
                      <button onClick={() => handleDelete(c.id)} className="ml-auto hidden text-[11px] text-gray-300 hover:text-red-500 group-hover:block">
                        삭제
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{renderContent(c.content)}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}

/* ── 댓글 입력 (모달 하단 고정) ── */
function TaskCommentInput({ taskId, projectId, projectMembers }: {
  taskId: string; projectId: string; projectMembers: Member[];
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // @all을 맨 앞에 포함한 멘션 목록
  const filteredMembers = mentionQuery
    ? projectMembers.filter((m) =>
        m.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : projectMembers;

  const allOption = (!mentionQuery || "all".includes(mentionQuery.toLowerCase()));
  const mentionOptions: { key: string; name: string }[] = [
    ...(allOption ? [{ key: "__all__", name: "all" }] : []),
    ...filteredMembers.map((m) => ({ key: m.id, name: m.name })),
  ];

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\S*)$/);
    if (atMatch) {
      setShowMention(true);
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMention(false);
      setMentionQuery("");
    }
  }

  function insertMention(name: string) {
    const cursor = inputRef.current?.selectionStart ?? input.length;
    const textBefore = input.slice(0, cursor);
    const textAfter = input.slice(cursor);
    const replaced = textBefore.replace(/@(\S*)$/, `@${name} `);
    setInput(replaced + textAfter);
    setShowMention(false);
    setMentionIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);
    const mentions = input.match(/@(\S+)/g) || [];
    const isAll = mentions.some((m) => m === "@all");
    const mentionedNames = mentions.map((m) => m.slice(1)).filter((n) => n !== "all");
    const mentionedIds = projectMembers.filter((m) => mentionedNames.includes(m.name)).map((m) => m.id);

    const result = await createTaskComment(taskId, projectId, input, mentionedIds, isAll);
    if (result?.error) { alert(result.error); }
    else {
      setInput("");
      window.dispatchEvent(new Event(`comment-refresh-${taskId}`));
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showMention && mentionOptions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => {
          const next = Math.min(prev + 1, mentionOptions.length - 1);
          scrollToItem(next);
          return next;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          scrollToItem(next);
          return next;
        });
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const selected = mentionOptions[mentionIndex];
        if (selected) insertMention(selected.name);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMention(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function scrollToItem(index: number) {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[index] as HTMLElement | undefined;
    if (item) item.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className="relative shrink-0 border-t border-gray-100 px-6 py-4">
      {showMention && mentionOptions.length > 0 && (
        <div ref={listRef} className="absolute bottom-full left-6 right-6 z-10 mb-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1">
          {mentionOptions.map((opt, i) => {
            const isAll = opt.key === "__all__";
            const member = !isAll ? projectMembers.find((m) => m.id === opt.key) : null;
            const isActive = i === mentionIndex;
            return (
              <button
                key={opt.key}
                onClick={() => insertMention(opt.name)}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
              >
                {isAll ? (
                  <>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-medium text-blue-600">@</div>
                    <div>
                      <p className="text-sm font-medium text-blue-600">@all</p>
                      <p className="text-[11px] text-gray-400">전체 멤버에게 알림</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {member?.avatarUrl ? <img src={member.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : opt.name[0]}
                    </div>
                    <div>
                      <p className="text-sm text-gray-900">{opt.name}</p>
                      <p className="text-[11px] text-gray-400">{member?.position || member?.email}</p>
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          {/* 하이라이트 오버레이 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words rounded-lg px-3.5 py-2.5 text-sm leading-[1.5] text-gray-900"
          >
            {input.split(/(@\S+)/g).map((part, i) =>
              part.startsWith("@")
                ? <span key={i} className="rounded bg-blue-50 font-medium text-blue-500">{part}</span>
                : <span key={i}>{part}</span>
            )}
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="댓글 입력... (@로 멘션)"
            rows={1}
            className="relative w-full resize-none rounded-lg border border-gray-200 bg-transparent px-3.5 py-2.5 text-sm text-transparent caret-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button onClick={handleSend} disabled={sending || !input.trim()} className="shrink-0 rounded-lg bg-blue-500 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-40">
          {sending ? "..." : "전송"}
        </button>
      </div>
    </div>
  );
}
