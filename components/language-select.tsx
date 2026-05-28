"use client";

import { useState, useRef, useEffect } from "react";
import { LANGUAGES } from "@/lib/languages";

export default function LanguageSelect({
  name = "language",
  defaultValue = "ko",
  onChange,
}: {
  name?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(
    LANGUAGES.find((l) => l.code === defaultValue) ?? LANGUAGES[0]
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const match = LANGUAGES.find((l) => l.code === defaultValue);
    if (match) setSelected(match);
  }, [defaultValue]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={selected.code} />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 transition-colors hover:border-gray-300 focus:border-blue-500 focus:outline-none"
      >
        <span className="flex items-center gap-2.5">
          <span className="text-base">{selected.flag}</span>
          <span>{selected.label}</span>
        </span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                setSelected(lang);
                setOpen(false);
                onChange?.(lang.code);
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:bg-gray-50 ${
                selected.code === lang.code ? "bg-blue-50 text-blue-500" : "text-gray-700"
              }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
