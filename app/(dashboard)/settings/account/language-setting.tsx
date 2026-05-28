"use client";

import { useState } from "react";
import LanguageSelect from "@/components/language-select";
import { updateLanguage } from "./actions";

export default function LanguageSetting({ currentLanguage }: { currentLanguage: string }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleChange(code: string) {
    if (code === currentLanguage) return;
    setSaving(true);
    setSaved(false);
    const result = await updateLanguage(code);
    setSaving(false);
    if (!result.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6">
      <h2 className="mb-4 text-sm font-medium text-gray-900">모국어</h2>
      <div className="flex items-center gap-3">
        <div className="w-52">
          <LanguageSelect
            defaultValue={currentLanguage}
            onChange={handleChange}
          />
        </div>
        {saving && <span className="text-xs text-gray-400">저장 중...</span>}
        {saved && <span className="text-xs text-emerald-500">저장됨</span>}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        팀원들에게 표시되는 기본 언어입니다
      </p>
    </div>
  );
}
