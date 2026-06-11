"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { updateTask, updateTaskStatus, deleteTask, getTaskComments, createTaskComment, deleteTaskComment } from "../actions";
import { useT, type TFunction } from "@/lib/i18n";
import type { Member, Task } from "./project-types";

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
      <p className="mb-3 text-xs font-medium text-gray-400">{t("comments.title")} {comments.length > 0 && comments.length}</p>
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
                    <span className="text-[11px] text-gray-400">{timeAgo(c.createdAt, t)}</span>
                    {isMine && (
                      <button onClick={() => handleDelete(c.id)} className="ml-auto hidden text-[11px] text-gray-300 hover:text-red-500 group-hover:block">
                        {t("common.delete")}
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
                      <p className="text-[11px] text-gray-400">{t("common.notifyAll")}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {member?.avatarUrl ? <Image src={member.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : opt.name[0]}
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
            placeholder={t("comments.placeholder")}
            rows={1}
            className="relative w-full resize-none rounded-lg border border-gray-200 bg-transparent px-3.5 py-2.5 text-sm text-transparent caret-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button onClick={handleSend} disabled={sending || !input.trim()} className="shrink-0 rounded-lg bg-blue-500 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-40">
          {sending ? "..." : t("common.send")}
        </button>
      </div>
    </div>
  );
}

/* ── 태스크 상세/수정 모달 ── */
export default function TaskDetailModal({ task, projectId, allMembers, projectMembers, currentUserId, onClose }: {
  task: Task; projectId: string; allMembers: Member[]; projectMembers: Member[]; currentUserId: string; onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [output, setOutput] = useState(task.output || "");
  const [editingOutput, setEditingOutput] = useState(!(task.output || "").trim());
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

  const filtered = allMembers.filter(
    (m) => !selectedIds.includes(m.id) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()))
  );

  const statusLabels: Record<string, string> = { todo: t("tasks.todo"), in_progress: t("tasks.inProgress"), pending: t("tasks.pending"), done: t("tasks.done") };

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
      next?.output ?? output,
      next?.startDate ?? startDate,
      next?.progress ?? progress,
    );
    setSaving(false);
    setError(errOf(r) || "");
    dirty.current = false;
  }
  async function changeStatus(s: "todo" | "in_progress" | "pending" | "done") {
    setStatus(s);
    await updateTaskStatus(task.id, s, projectId);
  }
  // 즉시 닫고, 미저장 변경은 백그라운드로 저장 후 새로고침
  function closeSave() {
    const wasDirty = dirty.current;
    dirty.current = false;
    onClose();
    (async () => {
      if (wasDirty) {
        await updateTask(task.id, projectId, title.trim() || task.title, description, priority, dueDate, selectedIds, output, startDate, progress);
      }
      router.refresh();
    })();
  }

  // ESC로 닫기 (최신 closeSave 참조)
  const escRef = useRef<() => void>(() => {});
  escRef.current = closeSave;
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
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={closeSave} />
      <div className="relative flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white">
        {/* 헤더: 상태 토글 + 저장표시 + 삭제 + 닫기 */}
        <div className="flex items-center justify-end border-b border-gray-100 px-6 py-3.5">
          <div className="flex items-center gap-1.5">
            <span className={`mr-1 text-xs text-gray-400 transition-opacity ${saving ? "opacity-100" : "opacity-0"}`}>{t("common.saving")}</span>
            <button onClick={handleDelete} disabled={deleting} title={t("common.delete")} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </button>
            <button onClick={closeSave} title={t("common.close")} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-5">
            {/* 제목 (인라인) */}
            <input value={title} onChange={(e) => { setTitle(e.target.value); dirty.current = true; }} onBlur={() => persist()} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} placeholder={t("tasks.taskTitle")}
              className="-mx-2 w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-lg font-semibold text-gray-900 transition-colors hover:bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />

            {/* ① 무엇을 — 결과물 + 진도율 (핵심) */}
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
              <p className="mb-2 text-xs font-semibold text-blue-600">① {t("tasks.what")}</p>
              {editingOutput ? (
                <textarea autoFocus value={output} onChange={(e) => { setOutput(e.target.value); dirty.current = true; }} onBlur={() => { persist(); setEditingOutput(false); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }} rows={2} placeholder={t("tasks.outputPlaceholder")}
                  className="w-full resize-none rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              ) : (
                <button type="button" onClick={() => setEditingOutput(true)} className="group flex w-full items-start gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-left transition-colors hover:border-blue-300">
                  {output.trim() ? (
                    <>
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" /></svg>
                      <span className="flex-1 whitespace-pre-wrap text-sm text-gray-900">{output}</span>
                      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">+ {t("tasks.outputPlaceholder")}</span>
                  )}
                </button>
              )}
              <div className="mt-3 flex items-center gap-3">
                <span className="shrink-0 text-xs font-medium text-gray-500">{t("tasks.progress")}</span>
                <input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => { const v = Number(e.target.value); setProgress(v); dirty.current = true; }} onMouseUp={() => persist()} onTouchEnd={() => persist()} className="h-1.5 flex-1 accent-blue-500" />
                <span className="w-10 text-right text-sm font-semibold text-blue-600 tabular-nums">{progress}%</span>
              </div>
            </div>

            {/* ② 언제까지 — 기간 (핵심) */}
            <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="mb-2 text-xs font-semibold text-gray-600">② {t("tasks.when")}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs text-gray-400">{t("tasks.startDate")}</span>
                <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); persist({ startDate: e.target.value }); }} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none" />
                <span className="text-gray-300">→</span>
                <span className="text-xs text-gray-400">{t("tasks.dueDate")}</span>
                <input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); persist({ dueDate: e.target.value }); }} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none" />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {/* 상태 + 우선순위 (보조, 드롭다운) */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-xs font-medium text-gray-400">{t("tasks.status")}</span>
                  <select value={status} onChange={(e) => changeStatus(e.target.value as "todo" | "in_progress" | "pending" | "done")} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none">
                    <option value="todo">{statusLabels.todo}</option>
                    <option value="in_progress">{statusLabels.in_progress}</option>
                    <option value="pending">{statusLabels.pending}</option>
                    <option value="done">{statusLabels.done}</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs font-medium text-gray-400">{t("tasks.priority")}</span>
                  <select value={priority} onChange={(e) => { const p = e.target.value as "low" | "medium" | "high"; setPriority(p); persist({ priority: p }); }} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              {/* 담당자 (인라인) */}
              <div className="flex items-start gap-3">
                <span className="mt-2 w-16 shrink-0 text-xs font-medium text-gray-400">{t("tasks.assignee")}</span>
                <div className="relative flex-1">
                  {selectedIds.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {selectedIds.map((mid) => {
                        const m = allMembers.find((x) => x.id === mid);
                        if (!m) return null;
                        return (
                          <span key={mid} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pr-2 pl-1.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-medium text-blue-600">{m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" /> : m.name[0]}</span>
                            <span className="text-xs font-medium text-blue-700">{m.name}</span>
                            <button type="button" onClick={() => { const ids = selectedIds.filter((id) => id !== mid); setSelectedIds(ids); persist({ selectedIds: ids }); }} className="text-blue-400 hover:text-blue-600"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <input ref={searchRef} type="text" value={search} onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} placeholder={selectedIds.length > 0 ? t("common.searchMore") : t("common.searchPlaceholder")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none" />
                  {showDropdown && (
                    <>
                      <div className="fixed inset-0 z-[5]" onClick={() => setShowDropdown(false)} />
                      <div className="absolute top-full left-0 z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1">
                        {filtered.length === 0 ? (
                          <p className="px-3.5 py-2 text-sm text-gray-400">{t("common.noResults")}</p>
                        ) : (
                          filtered.map((m) => (
                            <button key={m.id} type="button" onClick={() => { const ids = [...selectedIds, m.id]; setSelectedIds(ids); setSearch(""); setShowDropdown(false); persist({ selectedIds: ids }); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-gray-50">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">{m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : m.name[0]}</div>
                              <div><p className="text-sm text-gray-900">{m.name}</p><p className="text-[11px] text-gray-400">{m.position || m.email}</p></div>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 설명 (인라인) */}
          <div className="px-6 pb-3 pt-5">
            <p className="mb-2 text-xs font-medium text-gray-400">{t("tasks.content")}</p>
            <textarea value={description} onChange={(e) => { setDescription(e.target.value); dirty.current = true; }} onBlur={() => persist()} rows={4} placeholder={t("tasks.contentPlaceholder")} className="w-full resize-none rounded-lg bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>

          {/* 댓글 목록 */}
          <TaskCommentList taskId={task.id} projectMembers={projectMembers} currentUserId={currentUserId} projectId={projectId} />
        </div>

        {/* 댓글 입력 - 하단 고정 */}
        <TaskCommentInput taskId={task.id} projectId={projectId} projectMembers={projectMembers} />
      </div>
    </div>
  );
}
