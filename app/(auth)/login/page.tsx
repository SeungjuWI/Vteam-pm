"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { loginWithGoogle } from "../actions";
import DesktopDownload from "@/components/desktop-download";
import { makeT } from "@/lib/i18n";

const UI_LANGUAGES = [
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
] as const;

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1] : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
}

export default function LoginPage() {
  const [lang, setLang] = useState("ko");

  useEffect(() => {
    const saved = getCookie("vteam-ui-lang");
    if (saved) {
      setLang(saved);
    } else {
      const browserLang = navigator.language.startsWith("en") ? "en" : "ko";
      setLang(browserLang);
      setCookie("vteam-ui-lang", browserLang);
    }
  }, []);

  function handleLangChange(code: string) {
    setLang(code);
    setCookie("vteam-ui-lang", code);
  }

  const t = makeT(lang);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8">
        {/* Language Toggle */}
        <div className="mb-6 flex justify-center">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
            {UI_LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLangChange(l.code)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  lang === l.code
                    ? "bg-white text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{l.flag}</span>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Vteam" width={36} height={36} />
          <h1 className="text-xl font-bold text-gray-900">Vteam</h1>
          <p className="text-sm text-gray-500">{t("login.subtitle")}</p>
        </div>
        <form action={loginWithGoogle}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t("login.google")}
          </button>
        </form>
        <div className="mt-6 flex justify-center">
          <DesktopDownload variant="compact" />
        </div>
      </div>
    </div>
  );
}
