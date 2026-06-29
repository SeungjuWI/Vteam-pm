"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "@/lib/i18n";
import type { Member } from "./project-types";
import { type Objective, objectiveProgress, formatPeriod } from "./okr-types";
import {
  updateKeyResultProgress,
  createKeyResult,
  deleteKeyResult,
  deleteObjective,
} from "./okr-actions";
// 클릭 즉시 떠야 하므로 일반 import (dynamic 지연 로딩이면 첫 클릭 때 청크 컴파일/다운로드로 멈칫함)
import CreateOkrModal from "./create-okr-modal";

function periodLabel(period: string, locale: string): string {
  const [y, m] = period.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
  });
}

function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  return formatPeriod(new Date(y, m - 1 + delta, 1));
}

function progressColor(p: number): string {
  if (p >= 100) return "bg-green-500";
  if (p >= 50) return "bg-blue-500";
  if (p > 0) return "bg-amber-400";
  return "bg-gray-300";
}

export default function OkrSection({
  projectId,
  members,
  objectives: initialObjectives,
}: {
  projectId: string;
  members: Member[];
  objectives: Objective[];
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [objectives, setObjectives] = useState(initialObjectives);
  useEffect(() => { setObjectives(initialObjectives); }, [initialObjectives]);

  const [period, setPeriod] = useState(() => formatPeriod(new Date()));
  const [showCreate, setShowCreate] = useState(false);
  const [addingKrFor, setAddingKrFor] = useState<string | null>(null);
  const [newKrText, setNewKrText] = useState("");

  const visible = objectives.filter((o) => o.period === period);

  function commitProgress(keyResultId: string, value: number) {
    setObjectives((prev) =>
      prev.map((o) => ({
        ...o,
        keyResults: o.keyResults.map((kr) =>
          kr.id === keyResultId ? { ...kr, progress: value } : kr,
        ),
      })),
    );
  }

  async function persistProgress(keyResultId: string, value: number) {
    await updateKeyResultProgress(projectId, keyResultId, value);
  }

  async function handleAddKr(objectiveId: string) {
    const title = newKrText.trim();
    if (!title) {
      setAddingKrFor(null);
      return;
    }
    await createKeyResult(projectId, objectiveId, title);
    setNewKrText("");
    setAddingKrFor(null);
    router.refresh();
  }

  async function handleDeleteKr(keyResultId: string) {
    setObjectives((prev) =>
      prev.map((o) => ({
        ...o,
        keyResults: o.keyResults.filter((kr) => kr.id !== keyResultId),
      })),
    );
    await deleteKeyResult(projectId, keyResultId);
    router.refresh();
  }

  async function handleDeleteObjective(objectiveId: string) {
    if (!confirm(t("okr.deleteConfirm"))) return;
    setObjectives((prev) => prev.filter((o) => o.id !== objectiveId));
    await deleteObjective(projectId, objectiveId);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">{t("okr.title")}</h2>
          <div className="flex items-center gap-1 rounded-lg bg-white px-1 py-0.5">
            <button
              onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-[0.95]"
              aria-label="prev"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="min-w-[88px] text-center text-sm font-medium text-gray-700">
              {periodLabel(period, locale)}
            </span>
            <button
              onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-[0.95]"
              aria-label="next"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white transition-all duration-200 ease-spring hover:bg-blue-600 shadow-soft-sm active:scale-[0.98] hover:shadow-brand"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t("okr.add")}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white py-12">
          <svg className="h-8 w-8 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          </svg>
          <p className="text-sm text-gray-600">{t("okr.empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((o) => {
            const owner = members.find((m) => m.id === o.ownerId) || null;
            const prog = objectiveProgress(o);
            return (
              <div key={o.id} className="rounded-xl bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">O</span>
                      <h3 className="truncate text-sm font-semibold text-gray-900">{o.title}</h3>
                    </div>
                    {o.description && <p className="mt-1 text-xs text-gray-500">{o.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {owner && (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600" title={owner.name}>
                        {owner.avatarUrl ? <Image src={owner.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : owner.name[0]}
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteObjective(o.id)}
                      className="rounded-md p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 active:scale-[0.95]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 목표 전체 진행률 */}
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full transition-all duration-300 ${progressColor(prog)}`} style={{ width: `${prog}%` }} />
                  </div>
                  <span className="w-9 text-right text-xs font-semibold text-gray-700">{prog}%</span>
                </div>

                {/* 핵심결과 목록 */}
                <div className="mt-4 flex flex-col gap-3 border-t border-gray-50 pt-4">
                  {o.keyResults.map((kr) => (
                    <div key={kr.id} className="group/kr">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="rounded bg-gray-100 px-1 py-0.5 text-[9px] font-medium text-gray-400">KR</span>
                          {kr.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-9 text-right text-xs font-medium text-gray-500">{kr.progress}%</span>
                          <button
                            onClick={() => handleDeleteKr(kr.id)}
                            className="rounded p-0.5 text-gray-200 opacity-0 transition-opacity hover:text-red-500 group-hover/kr:opacity-100"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={kr.progress}
                        onChange={(e) => commitProgress(kr.id, Number(e.target.value))}
                        onMouseUp={(e) => persistProgress(kr.id, Number((e.target as HTMLInputElement).value))}
                        onTouchEnd={(e) => persistProgress(kr.id, Number((e.target as HTMLInputElement).value))}
                        onKeyUp={(e) => persistProgress(kr.id, Number((e.target as HTMLInputElement).value))}
                        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-100 accent-blue-500"
                      />
                    </div>
                  ))}

                  {/* 핵심결과 추가 */}
                  {addingKrFor === o.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newKrText}
                        onChange={(e) => setNewKrText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { if (e.nativeEvent.isComposing) return; handleAddKr(o.id); }
                          if (e.key === "Escape") { setAddingKrFor(null); setNewKrText(""); }
                        }}
                        placeholder={t("okr.keyResultPlaceholder")}
                        autoFocus
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                      />
                      <button onClick={() => handleAddKr(o.id)} className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white transition-all duration-200 ease-spring hover:bg-blue-600 shadow-soft-sm active:scale-[0.98] hover:shadow-brand">
                        {t("common.add")}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingKrFor(o.id); setNewKrText(""); }}
                      className="flex w-fit items-center gap-1 text-xs font-medium text-gray-400 transition-colors hover:text-blue-500"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      {t("okr.addKeyResult")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateOkrModal
          projectId={projectId}
          period={period}
          periodLabel={periodLabel(period, locale)}
          members={members}
          onClose={() => { setShowCreate(false); router.refresh(); }}
        />
      )}
    </div>
  );
}
