"use client";

import { useState } from "react";
import Image from "next/image";
import { createObjective } from "./okr-actions";
import { useT } from "@/lib/i18n";
import type { Member } from "./project-types";

export default function CreateOkrModal({
  projectId,
  period,
  periodLabel,
  members,
  onClose,
}: {
  projectId: string;
  period: string;
  periodLabel: string;
  members: Member[];
  onClose: () => void;
}) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [showOwner, setShowOwner] = useState(false);
  const [krs, setKrs] = useState<string[]>([""]);

  const owner = members.find((m) => m.id === ownerId) || null;

  function updateKr(i: number, value: string) {
    setKrs((prev) => prev.map((k, idx) => (idx === i ? value : k)));
  }
  function addKrField() {
    setKrs((prev) => [...prev, ""]);
  }
  function removeKrField(i: number) {
    setKrs((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    const result = await createObjective(
      projectId,
      period,
      title,
      description,
      ownerId,
      krs.filter((k) => k.trim()),
    );
    if (result && "error" in result) {
      setError(result.error);
      setLoading(false);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{t("okr.add")}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mb-5 text-xs text-gray-400">{periodLabel}</p>

        <div className="flex flex-col gap-4">
          {/* 목표 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              {t("okr.objective")} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("okr.objectivePlaceholder")}
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("okr.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("okr.descriptionPlaceholder")}
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* 담당자 */}
          <div className="relative">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("okr.owner")}</label>
            <button
              type="button"
              onClick={() => setShowOwner((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm transition-colors hover:bg-gray-50"
            >
              {owner ? (
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
                    {owner.avatarUrl ? <Image src={owner.avatarUrl} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" /> : owner.name[0]}
                  </span>
                  <span className="text-gray-900">{owner.name}</span>
                </span>
              ) : (
                <span className="text-gray-400">{t("okr.noOwner")}</span>
              )}
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {showOwner && (
              <>
                <div className="fixed inset-0 z-[5]" onClick={() => setShowOwner(false)} />
                <div className="absolute top-full left-0 z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1">
                  <button
                    type="button"
                    onClick={() => { setOwnerId(null); setShowOwner(false); }}
                    className="w-full px-3.5 py-2 text-left text-sm text-gray-400 transition-colors hover:bg-gray-50"
                  >
                    {t("okr.noOwner")}
                  </button>
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setOwnerId(m.id); setShowOwner(false); }}
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
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 핵심결과 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("okr.keyResults")}</label>
            <div className="flex flex-col gap-2">
              {krs.map((kr, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">{i + 1}</span>
                  <input
                    type="text"
                    value={kr}
                    onChange={(e) => updateKr(i, e.target.value)}
                    placeholder={t("okr.keyResultPlaceholder")}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                  {krs.length > 1 && (
                    <button type="button" onClick={() => removeKrField(i)} className="rounded-md p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addKrField}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-500 transition-colors hover:text-blue-600"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t("okr.addKeyResult")}
            </button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="mt-1 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
              {t("common.cancel")}
            </button>
            <button onClick={handleSubmit} disabled={loading} className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50">
              {loading ? t("common.creating") : t("okr.create")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
