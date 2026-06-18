"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createTask } from "../actions";
import { useT } from "@/lib/i18n";
import { kstTodayString } from "@/lib/date";
import type { Member, TaskStatus } from "./project-types";

export default function CreateTaskModal({ projectId, initialStatus = "todo", parentTaskId = null, parentTitle = null, allMembers, onClose }: { projectId: string; initialStatus?: TaskStatus; parentTaskId?: string | null; parentTitle?: string | null; allMembers: Member[]; onClose: () => void }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [startDate, setStartDate] = useState(kstTodayString());
  const [dueDate, setDueDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = allMembers.filter(
    (m) => !selectedIds.includes(m.id) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()))
  );

  const canSubmit = !!title.trim() && !!startDate && !!dueDate;

  async function handleSubmit() {
    if (!canSubmit) { setError("제목·시작일·마감일을 모두 입력해주세요"); return; }
    if (dueDate < startDate) { setError("마감일이 시작일보다 빠를 수 없어요"); return; }
    setLoading(true);
    setError("");
    const result = await createTask(projectId, title, description, priority, dueDate, selectedIds, initialStatus, parentTaskId, startDate);
    if (result?.error) { setError(result.error); setLoading(false); }
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6">
        <div className="mb-5 flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${parentTaskId ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-600"}`}>{parentTaskId ? t("tasks.addSub") : t("tasks.addMain")}</span>
            </div>
            {parentTaskId && parentTitle && (
              <p className="mt-1 truncate text-xs text-gray-400">상위 · <span className="font-medium text-gray-600">{parentTitle}</span></p>
            )}
          </div>
          <button onClick={onClose} className="ml-2 shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* 제목 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("tasks.taskTitle")} <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("tasks.titlePlaceholder")}
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* 작업 내용 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("tasks.content")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("tasks.contentPlaceholder")}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* 기간: 시작일 → 마감일 (필수) — 상세 모달과 동일 스타일 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("tasks.startDate")} · {t("tasks.dueDate")} <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">{t("tasks.startDate")}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-gray-300">→</span>
              <span className="text-xs text-gray-400">{t("tasks.dueDate")}</span>
              <input
                type="date"
                value={dueDate}
                min={startDate || undefined}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 우선순위 — 상세 모달과 동일한 드롭다운 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">{t("tasks.priority")}</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* 담당자 (복수) */}
          <div className="relative">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("tasks.assignee")}</label>
            {selectedIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedIds.map((mid) => {
                  const m = allMembers.find((member) => member.id === mid);
                  if (!m) return null;
                  return (
                    <span key={mid} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pr-2 pl-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-medium text-blue-600">
                        {m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" /> : m.name[0]}
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
              placeholder={selectedIds.length > 0 ? t("common.searchMore") : t("common.searchPlaceholder")}
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-[5]" onClick={() => setShowDropdown(false)} />
                <div className="absolute top-full left-0 z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1">
                  {filtered.length === 0 ? (
                    <p className="px-3.5 py-2 text-sm text-gray-400">
                      {allMembers.length === selectedIds.length ? t("common.allSelected") : t("common.noResults")}
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
                          {m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : m.name[0]}
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
              {t("common.cancel")}
            </button>
            <button onClick={handleSubmit} disabled={loading || !canSubmit} className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50">
              {loading ? t("common.creating") : t("tasks.create")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
