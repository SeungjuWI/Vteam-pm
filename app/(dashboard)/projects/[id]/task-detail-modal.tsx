"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { updateTask, updateTaskStatus, deleteTask, getTaskComments, createTaskComment, updateTaskComment, deleteTaskComment } from "../actions";
import { useT, type TFunction } from "@/lib/i18n";
import type { Member, Task } from "./project-types";
import { taskProgress, effectiveStatus } from "./project-types";

function errOf(r: unknown): string | undefined {
  return (r as { error?: string } | null | undefined)?.error;
}

/* ── 댓글 목록 (스크롤 영역 안) ── */
interface Comment {
  id: string;
  content: string;
  authorName: string;
  authorAvatarUrl: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string, t: TFunction) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("comments.justNow");
  if (min < 60) return `${min}${t("comments.minutesAgo")}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}${t("comments.hoursAgo")}`;
  return `${Math.floor(hr / 24)}${t("comments.daysAgo")}`;
}

function renderContent(content: string) {
  return content.split(/(@\S+)/g).map((part, i) =>
    part.startsWith("@") ? <span key={i} className="font-medium text-blue-500">{part}</span> : part
  );
}

function TaskCommentList({ taskId, projectMembers, currentUserId, projectId }: {
  taskId: string; projectMembers: Member[]; currentUserId: string; projectId: string;
}) {
  const t = useT();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);   // ⋯ 메뉴 열린 댓글
  const [editingId, setEditingId] = useState<string | null>(null); // 수정 중인 댓글
  const [editText, setEditText] = useState("");
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
    setMenuFor(null);
    await deleteTaskComment(commentId, projectId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }
  function startEdit(c: Comment) {
    setMenuFor(null);
    setEditingId(c.id);
    setEditText(c.content);
  }
  async function saveEdit(commentId: string) {
    const text = editText.trim();
    if (!text) return;
    setEditingId(null);
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: text } : c)));
    await updateTaskComment(commentId, projectId, text);
  }

  return (
    <div className="border-t border-gray-100 px-6 py-4">
      <p className="mb-3 text-xs font-medium text-gray-600">{t("comments.title")} {comments.length > 0 && comments.length}</p>
      {!loaded ? (
        <p className="py-4 text-center text-xs text-gray-300">{t("common.loading")}</p>
      ) : comments.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-300">{t("comments.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => {
            const isMine = projectMembers.some((m) => m.name === c.authorName && m.id === currentUserId);
            return (
              <div key={c.id} className="group flex gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
                  {c.authorAvatarUrl ? <Image src={c.authorAvatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : c.authorName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-900">{c.authorName}</span>
                    <span className="text-[11px] text-gray-600">{timeAgo(c.createdAt, t)}</span>
                    {isMine && editingId !== c.id && (
                      <div className="relative ml-auto">
                        <button onClick={() => setMenuFor((v) => (v === c.id ? null : c.id))} title={t("common.more")} className={`flex h-6 w-6 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600 ${menuFor === c.id ? "bg-gray-100 text-gray-600" : "opacity-0 group-hover:opacity-100"}`}>
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" /></svg>
                        </button>
                        {menuFor === c.id && (
                          <>
                            <div className="fixed inset-0 z-[5]" onClick={() => setMenuFor(null)} />
                            <div className="absolute right-0 top-full z-10 mt-1 w-28 overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-soft-lg">
                              <button onClick={() => startEdit(c)} className="flex w-full items-center px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">{t("common.edit")}</button>
                              <button onClick={() => handleDelete(c.id)} className="flex w-full items-center px-3 py-2 text-left text-xs font-medium text-red-500 transition-colors hover:bg-red-50">{t("common.delete")}</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {editingId === c.id ? (
                    <div className="mt-1">
                      <textarea
                        value={editText}
                        autoFocus
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(c.id); }
                          else if (e.key === "Escape") { e.preventDefault(); setEditingId(null); }
                        }}
                        rows={2}
                        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-50"
                      />
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button onClick={() => saveEdit(c.id)} className="rounded-lg bg-blue-500 px-3 py-1 text-[11px] font-bold text-white transition-colors hover:bg-blue-600">{t("common.save")}</button>
                        <button onClick={() => setEditingId(null)} className="rounded-lg px-3 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100">{t("common.cancel")}</button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{renderContent(c.content)}</p>
                  )}
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
  const t = useT();
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
    if (errOf(result)) { alert(errOf(result)); }
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
                      <p className="text-[11px] text-gray-600">{t("common.notifyAll")}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {member?.avatarUrl ? <Image src={member.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : opt.name[0]}
                    </div>
                    <div>
                      <p className="text-sm text-gray-900">{opt.name}</p>
                      <p className="text-[11px] text-gray-600">{member?.position || member?.email}</p>
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
            placeholder={t("comments.placeholder")}
            rows={1}
            className="relative w-full resize-none rounded-lg border border-gray-200 bg-transparent px-3.5 py-2.5 pr-4 text-sm text-transparent caret-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
          {sending && <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-gray-300">···</span>}
        </div>
      </div>
    </div>
  );
}

/* ── 아이콘 (line, 1.8 stroke) ── */
const ico = "shrink-0";
function IcCalendar({ className = "" }: { className?: string }) { return <svg className={`${ico} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0V11.25A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>; }
function IcFlag({ className = "" }: { className?: string }) { return <svg className={`${ico} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>; }
function IcUser({ className = "" }: { className?: string }) { return <svg className={`${ico} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>; }
function IcText({ className = "" }: { className?: string }) { return <svg className={`${ico} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5" /></svg>; }
function IcX({ className = "" }: { className?: string }) { return <svg className={`${ico} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>; }

/* 보기 모드 속성 행 */
function PropRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="flex w-[88px] shrink-0 items-center gap-2 pt-0.5 text-xs font-medium text-gray-500">
        <span className="text-gray-400">{icon}</span>{label}
      </div>
      <div className="min-w-0 flex-1 text-sm text-gray-800">{children}</div>
    </div>
  );
}

/* ── 태스크 상세/수정 모달 ── */
export default function TaskDetailModal({ task, projectId, allMembers, projectMembers, currentUserId, onClose, isDraft = false, subtasks = [] }: {
  task: Task; projectId: string; allMembers: Member[]; projectMembers: Member[]; currentUserId: string; onClose: () => void; isDraft?: boolean; subtasks?: Task[];
}) {
  const t = useT();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [progress, setProgress] = useState(task.progress ?? 0);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [startDate, setStartDate] = useState(task.startDate || "");
  const [status, setStatus] = useState(task.status);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    allMembers.filter((m) => task.assignees.some((a) => a.name === m.name)).map((m) => m.id)
  );
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);
  // 보기 모드 기본 — 새로 만든 드래프트만 바로 편집 모드로 진입
  const [mode, setMode] = useState<"view" | "edit">(isDraft ? "edit" : "view");
  const [menuOpen, setMenuOpen] = useState(false);  // ⋯ 더보기 메뉴
  const [closing, setClosing] = useState(false);    // 닫힘 슬라이드 애니메이션

  const filtered = allMembers.filter(
    (m) => !selectedIds.includes(m.id) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()))
  );

  const statusLabels: Record<string, string> = { todo: t("tasks.todo"), in_progress: t("tasks.inProgress"), pending: t("tasks.pending"), done: t("tasks.done") };
  const statusMeta: Record<string, { pill: string; dot: string }> = {
    todo: { pill: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
    in_progress: { pill: "bg-blue-50 text-blue-600", dot: "bg-blue-500" },
    pending: { pill: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
    done: { pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  };
  const statusOrder: ("todo" | "in_progress" | "pending" | "done")[] = ["todo", "in_progress", "pending", "done"];
  const priorityMeta: Record<string, { label: string; pill: string; dot: string }> = {
    low: { label: t("tasks.priorityLow"), pill: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
    medium: { label: t("tasks.priorityMedium"), pill: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
    high: { label: t("tasks.priorityHigh"), pill: "bg-red-50 text-red-600", dot: "bg-red-500" },
  };
  const priorityOrder: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
  // 진행도: 서브태스크가 있으면 자동 집계(타임라인·트리와 동일 공식), 없으면 완료=100/직접 입력값.
  const hasSubs = subtasks.length > 0;
  const displayProgress = taskProgress({ status, progress, subtasks });
  // 진도율이 있으면 '진행 중'으로 표시 (status가 todo로 남아도)
  const displayStatus = effectiveStatus({ status, progress: displayProgress });
  const fieldLabel = "mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500";
  const inputBase = "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-50";

  // 결과물(output)은 UI에서 빼되 기존 저장값은 그대로 보존한다.
  const outputJoined = task.output ?? "";

  // 인라인 자동 저장
  async function persist(next?: Partial<{ title: string; description: string; priority: "low" | "medium" | "high"; dueDate: string; startDate: string; selectedIds: string[]; output: string; progress: number }>) {
    setSaving(true);
    const r = await updateTask(
      task.id, projectId,
      (next?.title ?? title).trim() || task.title,
      next?.description ?? description,
      next?.priority ?? priority,
      next?.dueDate ?? dueDate,
      next?.selectedIds ?? selectedIds,
      next?.output ?? outputJoined,
      next?.startDate ?? startDate,
      next?.progress ?? progress,
    );
    setSaving(false);
    setError(errOf(r) || "");
    dirty.current = false;
    return !errOf(r);
  }
  // 진도율 조정 확정: 진도가 생겼는데 '시작 전'이면 '진행 중'으로 자동 승격 후 저장
  async function commitProgress() {
    if (progress > 0 && status === "todo") await changeStatus("in_progress");
    await persist();
    router.refresh();
  }
  async function changeStatus(s: "todo" | "in_progress" | "pending" | "done") {
    const prev = status;
    setStatus(s);
    // 서브 없는 태스크를 완료로 바꾸면 진행도도 100%로 맞춘다(막대·모달 일치).
    if (!hasSubs && s === "done" && progress !== 100) { setProgress(100); persist({ progress: 100 }); }
    const r = await updateTaskStatus(task.id, s, projectId);
    if (errOf(r)) { alert(errOf(r)); setStatus(prev); }  // 실패 시 알림 + 되돌림
  }
  // 편집 모드에서 저장 → 보기 모드로 복귀 (미저장 변경만 반영)
  async function saveAndView() {
    if (isDraft && !title.trim()) { requestClose(); return; }  // 빈 드래프트는 정리(삭제)
    if (dirty.current) { const ok = await persist(); if (!ok) return; }  // 저장 실패면 편집 화면 유지
    setMode("view");   // 저장 성공 → 읽기 전용 보기로 복귀
    router.refresh();
  }
  // 즉시 닫고, 미저장 변경은 백그라운드로 저장 후 새로고침
  function closeSave() {
    const wasDirty = dirty.current;
    dirty.current = false;
    onClose();
    (async () => {
      if (isDraft && !title.trim()) {
        // 제목 없이 닫은 빈 드래프트 → 정리(삭제)
        await deleteTask(task.id, projectId);
      } else if (wasDirty) {
        await updateTask(task.id, projectId, title.trim() || task.title, description, priority, dueDate, selectedIds, outputJoined, startDate, progress);
      }
      router.refresh();
    })();
  }

  // 슬라이드로 접은 뒤 닫기 (패널이 우측으로 사라지는 모션)
  function requestClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(() => closeSave(), 220);
  }

  // ESC로 닫기 (최신 requestClose 참조)
  const escRef = useRef<() => void>(() => {});
  escRef.current = requestClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") escRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  async function handleDelete() {
    if (!confirm(t("tasks.deleteConfirm"))) return;
    setDeleting(true);
    const result = await deleteTask(task.id, projectId);
    if (errOf(result)) { alert(errOf(result)); setDeleting(false); }
    else { onClose(); router.refresh(); }  // 삭제 후 목록 즉시 반영
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-gray-900/30" onClick={requestClose} style={{ animation: closing ? "overlay-in 0.2s ease reverse forwards" : "overlay-in 0.2s ease" }} />
      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-[540px] flex-col overflow-hidden border-l border-gray-100 bg-white shadow-soft-xl"
        style={{ animation: `${closing ? "drawer-out" : "drawer-in"} 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards` }}
      >
        {/* 상단 바 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          {mode === "view" ? (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusMeta[displayStatus].pill}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta[displayStatus].dot}`} />{statusLabels[displayStatus]}
            </span>
          ) : (
            <span className="text-sm font-bold tracking-[-0.01em] text-gray-900">{t("tasks.edited")}</span>
          )}
          <div className="flex items-center gap-1">
            {mode === "edit" && (
              <button onMouseDown={(e) => e.preventDefault()} onClick={saveAndView} className="mr-1 rounded-xl bg-blue-500 px-4 py-2 text-xs font-bold text-white transition-all duration-200 ease-spring hover:bg-blue-600 shadow-soft-sm active:scale-[0.97] hover:shadow-brand">
                {saving ? t("common.saving") : t("common.save")}
              </button>
            )}
            {/* ⋯ 더보기 — 수정/삭제 */}
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} disabled={deleting} title={t("common.more")} className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 active:scale-[0.95]">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" /></svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-10 mt-1.5 w-36 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-soft-lg">
                    {mode === "view" && (
                      <button onClick={() => { setMenuOpen(false); setMode("edit"); }} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>
                        {t("common.edit")}
                      </button>
                    )}
                    <button onClick={() => { setMenuOpen(false); handleDelete(); }} disabled={deleting} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      {t("common.delete")}
                    </button>
                  </div>
                </>
              )}
            </div>
            <button onClick={requestClose} title={t("common.close")} className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-[0.95]">
              <IcX className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* ── 보기 모드: 저장된 내용 읽기 전용 표시 ── */}
          {mode === "view" && (
            <div>
              {/* 제목 + 진행률 + 속성 */}
              <div className="px-6 pb-5 pt-5">
                <h2 className="break-words text-[22px] font-bold leading-snug tracking-[-0.015em] text-gray-900">{title || t("tasks.taskTitle")}</h2>

                <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <div className="mb-2 flex items-end justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                      {t("tasks.progress")}
                      {hasSubs && <span className="rounded-full bg-gray-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{t("tasks.autoFromSubs")}</span>}
                    </span>
                    <span className="text-lg font-bold leading-none text-blue-500 tabular-nums">{displayProgress}<span className="ml-0.5 text-xs font-semibold text-gray-400">%</span></span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200/70">
                    <div className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-spring" style={{ width: `${displayProgress}%` }} />
                  </div>
                </div>

                <div className="mt-4 flex flex-col divide-y divide-gray-50">
                  <PropRow icon={<IcCalendar className="h-4 w-4" />} label={t("tasks.schedule")}>
                    {startDate || dueDate ? (
                      <span className="inline-flex items-center gap-2 tabular-nums">
                        <span>{startDate || "—"}</span><span className="text-gray-400">~</span><span>{dueDate || "—"}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">{t("tasks.noDate")}</span>
                    )}
                  </PropRow>
                  <PropRow icon={<IcFlag className="h-4 w-4" />} label={t("tasks.priority")}>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityMeta[priority].pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${priorityMeta[priority].dot}`} />{priorityMeta[priority].label}
                    </span>
                  </PropRow>
                  <PropRow icon={<IcUser className="h-4 w-4" />} label={t("tasks.assignee")}>
                    {selectedIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedIds.map((mid) => {
                          const m = allMembers.find((x) => x.id === mid);
                          if (!m) return null;
                          return (
                            <span key={mid} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pr-2.5 pl-1">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-semibold text-blue-600">{m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" /> : m.name[0]}</span>
                              <span className="text-xs font-medium text-blue-700">{m.name}</span>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-gray-400">{t("tasks.noAssignee")}</span>
                    )}
                  </PropRow>
                </div>
              </div>

              {/* 설명 */}
              <div className="border-t border-gray-100 px-6 py-5">
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-500"><IcText className="h-4 w-4 text-gray-400" />{t("tasks.content")}</p>
                {description.trim() ? (
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{description}</p>
                ) : (
                  <p className="text-sm text-gray-400">{t("tasks.noContent")}</p>
                )}
              </div>
            </div>
          )}

          {/* ── 편집 모드: 인라인 수정 폼 ── */}
          {mode === "edit" && (
          <>
          {/* 제목 */}
          <div className="px-6 pt-5">
            <input value={title} autoFocus={isDraft} onChange={(e) => { setTitle(e.target.value); dirty.current = true; }} onBlur={() => persist()} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} placeholder={t("tasks.taskTitle")}
              className="-mx-3 w-[calc(100%+1.5rem)] rounded-xl px-3 py-1.5 text-[22px] font-bold tracking-[-0.015em] text-gray-900 transition-colors placeholder:text-gray-300 hover:bg-gray-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-50" />
          </div>

          {/* 진행률 */}
          <div className="px-6 pt-5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">{t("tasks.progress")}</span>
              <span className="text-sm font-bold text-blue-500 tabular-nums">{displayProgress}%</span>
            </div>
            {hasSubs || status === "done" ? (
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200/70">
                  <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${displayProgress}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-gray-400">{hasSubs ? t("tasks.progressAuto") : t("tasks.progressDone")}</p>
              </div>
            ) : (
              <input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => { const v = Number(e.target.value); setProgress(v); dirty.current = true; }} onMouseUp={commitProgress} onTouchEnd={commitProgress} className="h-1.5 w-full accent-blue-500" />
            )}
          </div>

          {/* 일정 */}
          <div className="px-6 pt-5">
            <p className={fieldLabel}><IcCalendar className="h-4 w-4 text-gray-400" />{t("tasks.schedule")}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-gray-400">{t("tasks.startDate")}</label>
                <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); persist({ startDate: e.target.value }); }} className={inputBase} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-400">{t("tasks.dueDate")}</label>
                <input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); persist({ dueDate: e.target.value }); }} className={inputBase} />
              </div>
            </div>
          </div>

          {/* 상태 */}
          <div className="px-6 pt-5">
            <p className={fieldLabel}>{t("tasks.status")}</p>
            <div className="flex flex-wrap gap-1.5">
              {statusOrder.map((s) => (
                <button key={s} type="button" onClick={() => changeStatus(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] ${status === s ? `${statusMeta[s].pill} shadow-soft-xs` : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}>
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          </div>

          {/* 우선순위 */}
          <div className="px-6 pt-5">
            <p className={fieldLabel}><IcFlag className="h-4 w-4 text-gray-400" />{t("tasks.priority")}</p>
            <div className="flex gap-1.5">
              {priorityOrder.map((p) => (
                <button key={p} type="button" onClick={() => { setPriority(p); persist({ priority: p }); }} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97] ${priority === p ? `${priorityMeta[p].pill} shadow-soft-xs` : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${priority === p ? priorityMeta[p].dot : "bg-gray-300"}`} />{priorityMeta[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* 담당자 */}
          <div className="px-6 pt-5">
            <p className={fieldLabel}><IcUser className="h-4 w-4 text-gray-400" />{t("tasks.assignee")}</p>
            <div className="relative">
              {selectedIds.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {selectedIds.map((mid) => {
                    const m = allMembers.find((x) => x.id === mid);
                    if (!m) return null;
                    return (
                      <span key={mid} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pr-2 pl-1">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-semibold text-blue-600">{m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" /> : m.name[0]}</span>
                        <span className="text-xs font-medium text-blue-700">{m.name}</span>
                        <button type="button" onClick={() => { const ids = selectedIds.filter((id) => id !== mid); setSelectedIds(ids); persist({ selectedIds: ids }); }} className="text-blue-400 hover:text-blue-600"><IcX className="h-3.5 w-3.5" /></button>
                      </span>
                    );
                  })}
                </div>
              )}
              <input ref={searchRef} type="text" value={search} onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} placeholder={selectedIds.length > 0 ? t("common.searchMore") : t("common.searchPlaceholder")} className={inputBase} />
              {showDropdown && (
                <>
                  <div className="fixed inset-0 z-[5]" onClick={() => setShowDropdown(false)} />
                  <div className="absolute top-full left-0 z-10 mt-1.5 max-h-44 w-full overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-soft-lg">
                    {filtered.length === 0 ? (
                      <p className="px-3.5 py-2 text-sm text-gray-500">{t("common.noResults")}</p>
                    ) : (
                      filtered.map((m) => (
                        <button key={m.id} type="button" onClick={() => { const ids = [...selectedIds, m.id]; setSelectedIds(ids); setSearch(""); setShowDropdown(false); persist({ selectedIds: ids }); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-gray-50">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">{m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : m.name[0]}</div>
                          <div><p className="text-sm text-gray-900">{m.name}</p><p className="text-[11px] text-gray-600">{m.position || m.email}</p></div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 설명 */}
          <div className="px-6 pb-5 pt-5">
            <p className={fieldLabel}><IcText className="h-4 w-4 text-gray-400" />{t("tasks.content")}</p>
            <textarea value={description} onChange={(e) => { setDescription(e.target.value); dirty.current = true; }} onBlur={() => persist()} rows={4} placeholder={t("tasks.contentPlaceholder")} className={`${inputBase} resize-none`} />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>
          </>
          )}

          {/* 댓글 목록 */}
          <TaskCommentList taskId={task.id} projectMembers={projectMembers} currentUserId={currentUserId} projectId={projectId} />
        </div>

        {/* 댓글 입력 - 하단 고정 */}
        <TaskCommentInput taskId={task.id} projectId={projectId} projectMembers={projectMembers} />
      </div>
    </div>
  );
}
