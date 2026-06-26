"use client";

import { useState } from "react";
import Image from "next/image";
import { addProjectMember } from "../actions";
import { useT } from "@/lib/i18n";
import type { Member } from "./project-types";

export default function AddMemberModal({ projectId, currentMemberIds, allMembers, onAdded, onClose }: { projectId: string; currentMemberIds: string[]; allMembers: Member[]; onAdded: (m: Member) => void; onClose: () => void }) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const available = allMembers.filter(
    (m) => !currentMemberIds.includes(m.id) && !addedIds.has(m.id) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()))
  );

  // 추가해도 닫지 않음 — 추가된 멤버는 목록에서 빠지고 계속 추가 가능
  async function handleAdd(memberId: string) {
    setLoading(memberId);
    const result = await addProjectMember(projectId, memberId);
    if (result?.error) alert(result.error);
    else {
      setAddedIds((prev) => new Set(prev).add(memberId));
      const m = allMembers.find((x) => x.id === memberId);
      if (m) onAdded(m);
    }
    setLoading(null);
  }

  function close() { onClose(); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={close} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{t("members.addMember")} {addedIds.size > 0 && <span className="text-xs font-normal text-blue-500">{addedIds.size}명 추가됨</span>}</h2>
          <button onClick={close} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-[0.95]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("common.searchPlaceholder")} className="mb-3 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none" autoFocus />
        <div className="scrollbar-hide max-h-64 overflow-y-auto">
          {available.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600">{allMembers.length === currentMemberIds.length ? t("projects.allMembersJoined") : t("common.noResults")}</p>
          ) : (
            available.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    {m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" /> : m.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.name}</p>
                    <p className="text-[11px] text-gray-600">{m.position || m.email}</p>
                  </div>
                </div>
                <button onClick={() => handleAdd(m.id)} disabled={loading === m.id} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50">
                  {loading === m.id ? t("members.adding") : t("common.add")}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
