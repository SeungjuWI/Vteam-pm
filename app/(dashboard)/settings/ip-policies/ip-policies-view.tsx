"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { createIpPolicy, updateIpPolicy, deleteIpPolicy } from "./actions";

type Policy = {
  id: string;
  name: string;
  cidrs: string[];
  memberCount: number;
};

export default function IpPoliciesView({
  policies,
  currentIp,
}: {
  policies: Policy[];
  currentIp: string | null;
}) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [cidrs, setCidrs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setName("");
    setCidrs("");
    setError(null);
    setSaving(false);
  }

  function startAdd() {
    resetForm();
    setEditingId(null);
    setConfirmDeleteId(null);
    setAdding(true);
  }

  function startEdit(p: Policy) {
    setName(p.name);
    setCidrs(p.cidrs.join("\n"));
    setError(null);
    setSaving(false);
    setAdding(false);
    setConfirmDeleteId(null);
    setEditingId(p.id);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    resetForm();
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = editingId
      ? await updateIpPolicy(editingId, name, cidrs)
      : await createIpPolicy(name, cidrs);
    if (res && "error" in res) {
      setError(res.error ?? t("common.errorOccurred"));
      setSaving(false);
      return;
    }
    cancel();
  }

  async function handleDelete(id: string) {
    const res = await deleteIpPolicy(id);
    if (res && "error" in res) {
      setError(res.error ?? t("common.errorOccurred"));
      return;
    }
    setConfirmDeleteId(null);
  }

  const formCard = (
    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-5">
      <p className="mb-3 text-sm font-medium text-gray-900">
        {editingId ? t("ipPolicy.editTitle") : t("ipPolicy.newTitle")}
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("ipPolicy.nameLabel")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("ipPolicy.namePlaceholder")}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("ipPolicy.cidrsLabel")}</label>
          <textarea
            value={cidrs}
            onChange={(e) => setCidrs(e.target.value)}
            rows={4}
            placeholder={"203.0.113.0/24\n1.2.3.4\n2001:db8::/32"}
            className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-gray-600">{t("ipPolicy.cidrsHelp")}</p>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
          <button onClick={cancel} className="text-xs text-gray-400 hover:text-gray-600">
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* 안내 + 현재 IP */}
      <div className="rounded-xl bg-white p-5">
        <h2 className="text-sm font-medium text-gray-900">{t("ipPolicy.title")}</h2>
        <p className="mt-1 text-xs text-gray-500">{t("ipPolicy.description")}</p>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
          <span className="text-xs text-gray-500">{t("ipPolicy.currentIp")}</span>
          <span className="font-mono text-xs text-gray-900">{currentIp ?? "-"}</span>
        </div>
      </div>

      {/* 정책 목록 */}
      <div className="rounded-xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-medium text-gray-900">
            {t("ipPolicy.listTitle")} <span className="ml-1 text-gray-600">{policies.length}</span>
          </h2>
          {!adding && !editingId && (
            <button
              onClick={startAdd}
              className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98]"
            >
              {t("ipPolicy.addPolicy")}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 p-5">
          {adding && formCard}

          {policies.length === 0 && !adding ? (
            <p className="py-6 text-center text-sm text-gray-600">{t("ipPolicy.empty")}</p>
          ) : (
            policies.map((p) =>
              editingId === p.id ? (
                <div key={p.id}>{formCard}</div>
              ) : (
                <div key={p.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                          {t("ipPolicy.memberCount").replace("{n}", String(p.memberCount))}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.cidrs.length === 0 ? (
                          <span className="text-xs text-gray-600">{t("ipPolicy.noCidr")}</span>
                        ) : (
                          p.cidrs.map((c) => (
                            <span
                              key={c}
                              className="rounded-md bg-gray-50 px-2 py-0.5 font-mono text-[11px] text-gray-600"
                            >
                              {c}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => startEdit(p)}
                        className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-[0.95]"
                        title={t("common.edit")}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                      {confirmDeleteId === p.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="rounded bg-red-500 px-1.5 py-0.5 text-[11px] text-white hover:bg-red-600"
                          >
                            {t("common.delete")}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[11px] text-gray-400"
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 active:scale-[0.95]"
                          title={t("common.delete")}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {confirmDeleteId === p.id && p.memberCount > 0 && (
                    <p className="mt-2 text-[11px] text-red-400">
                      {t("ipPolicy.deleteWarn").replace("{n}", String(p.memberCount))}
                    </p>
                  )}
                </div>
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}
