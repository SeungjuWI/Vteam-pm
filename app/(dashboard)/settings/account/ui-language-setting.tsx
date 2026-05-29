"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUiLanguage } from "./actions";
import { useT } from "@/lib/i18n";

const UI_LANGUAGES = [
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
] as const;

export default function UiLanguageSetting({ currentUiLang }: { currentUiLang: string }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const t = useT();
  const router = useRouter();

  async function handleChange(code: string) {
    if (code === currentUiLang) return;
    setSaving(true);
    setSaved(false);
    const result = await updateUiLanguage(code);
    setSaving(false);
    if (!("error" in result)) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6">
      <h2 className="mb-4 text-sm font-medium text-gray-900">{t("account.uiLanguage")}</h2>
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          {UI_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleChange(lang.code)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                currentUiLang === lang.code
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
        {saving && <span className="text-xs text-gray-400">{t("common.saving")}</span>}
        {saved && <span className="text-xs text-emerald-500">{t("common.saved")}</span>}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {t("account.uiLanguageDesc")}
      </p>
    </div>
  );
}
