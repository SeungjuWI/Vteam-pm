"use client";

import { useState } from "react";
import { adjustBalance } from "./actions";
import { useT } from "@/lib/i18n";

type Member = {
  id: string;
  name: string;
  email: string;
  total: number;
  used: number;
};

export default function BalanceManager({ members }: { members: Member[] }) {
  const t = useT();
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(0);

  async function handleSave(employeeId: string) {
    const formData = new FormData();
    formData.set("employeeId", employeeId);
    formData.set("total", String(editValue));
    await adjustBalance(formData);
    setEditing(null);
  }

  return (
    <div className="rounded-xl bg-white">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-sm font-medium text-gray-900">{t("leaveSettings.balanceTitle")}</h2>
      </div>
      {members.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-gray-600">{t("leaveSettings.balanceEmpty")}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {members.map((m) => {
            const remaining = m.total - m.used;
            return (
              <div key={m.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    {m.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-600">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{remaining}</span>
                      <span className="text-gray-600">/{m.total}{t("common.days")}</span>
                    </p>
                    <p className="text-xs text-gray-600">{t("leaves.used")} {m.used}{t("common.days")}</p>
                  </div>
                  {editing === m.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(Number(e.target.value))}
                        min={0}
                        max={50}
                        className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleSave(m.id)}
                        className="rounded-lg bg-blue-500 px-2.5 py-1 text-xs font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:shadow-brand active:scale-[0.98]"
                      >
                        {t("common.save")}
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-xs text-gray-600"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditing(m.id); setEditValue(m.total); }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      {t("common.edit")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
