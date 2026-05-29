"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LanguageSelect from "@/components/language-select";
import { updateLanguage } from "./actions";
import { useT } from "@/lib/i18n";

export default function LanguageSetting({ currentLanguage }: { currentLanguage: string }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const t = useT();
  const router = useRouter();

  async function handleChange(code: string) {
    if (code === currentLanguage) return;
    setSaving(true);
    setSaved(false);
    const result = await updateLanguage(code);
    setSaving(false);
    if (!("error" in result)) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6">
      <h2 className="mb-4 text-sm font-medium text-gray-900">{t("account.language")}</h2>
      <div className="flex items-center gap-3">
        <div className="w-52">
          <LanguageSelect
            defaultValue={currentLanguage}
            onChange={handleChange}
          />
        </div>
        {saving && <span className="text-xs text-gray-400">{t("common.saving")}</span>}
        {saved && <span className="text-xs text-emerald-500">{t("common.saved")}</span>}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {t("account.languageDesc")}
      </p>
    </div>
  );
}
