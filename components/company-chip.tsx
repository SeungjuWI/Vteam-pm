"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useT } from "@/lib/i18n";

interface CompanyInfo {
  name: string;
  foundedAt: string | null;
  memberCount: number;
  businessNumber: string | null;
  corpNumber: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
}

interface ProfileInfo {
  name: string;
  role: string;
}

function daysSince(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-auto flex-shrink-0 pl-2 text-gray-300 transition-colors hover:text-gray-500"
      title={label}
    >
      {copied ? (
        <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
      )}
    </button>
  );
}

export default function CompanyChip({
  profile,
  company,
}: {
  profile: ProfileInfo;
  company: CompanyInfo | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const ROLE_KEYS = { admin: "role.admin", employee: "role.employee" } as const;

  const handleToggle = useCallback(() => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
    setOpen((prev) => !prev);
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  if (!company) {
    return (
      <div className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2">
        <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-gray-100" />
        <div className="h-4 flex-1 rounded bg-gray-100" />
      </div>
    );
  }

  const roleKey = profile.role as keyof typeof ROLE_KEYS;
  const roleLabel = roleKey in ROLE_KEYS ? t(ROLE_KEYS[roleKey]) : profile.role;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-gray-50"
      >
        {company.logoUrl ? (
          <Image src={company.logoUrl} alt="" width={32} height={32} className="h-8 w-8 flex-shrink-0 rounded-lg object-contain" />
        ) : (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-medium text-gray-400">
            {company.name.charAt(0)}
          </div>
        )}
        <span className="flex-1 truncate text-left text-sm font-medium text-gray-900">{company.name}</span>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-80 rounded-2xl border border-gray-200 bg-white py-5"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <div className="mb-4 flex items-center gap-3 px-5">
            {company.logoUrl ? (
              <Image src={company.logoUrl} alt="" width={44} height={44} className="h-11 w-11 flex-shrink-0 rounded-xl object-contain" />
            ) : (
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-base font-medium text-gray-400">
                {company.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium text-gray-900">{company.name}</div>
              <div className="text-xs text-gray-500">
                {t("companyChip.representative")} {roleLabel}
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          <div className="mt-3 space-y-0.5 px-5">
            <div className="flex items-center gap-2.5 py-1.5 text-[13px]">
              <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <span className="text-gray-700">{t("companyChip.employees")} {company.memberCount}</span>
            </div>

            {company.foundedAt && (
              <div className="flex items-center gap-2.5 py-1.5 text-[13px]">
                <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span className="text-gray-700">{formatDate(company.foundedAt)}</span>
                <span className="text-gray-400">{t("companyChip.founded")}</span>
                <span className="text-blue-500">{daysSince(company.foundedAt).toLocaleString()} {t("companyChip.daysRunning")}</span>
              </div>
            )}

            {company.businessNumber && (
              <div className="flex items-center gap-2.5 py-1.5 text-[13px]">
                <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                </svg>
                <span className="text-gray-400">{t("company.businessNumber")}</span>
                <span className="text-gray-900">{company.businessNumber}</span>
                <CopyButton value={company.businessNumber} label={t("companyChip.copy")} />
              </div>
            )}

            {company.corpNumber && (
              <div className="flex items-center gap-2.5 py-1.5 text-[13px]">
                <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span className="text-gray-400">{t("company.corpNumber")}</span>
                <span className="text-gray-900">{company.corpNumber}</span>
                <CopyButton value={company.corpNumber} label={t("companyChip.copy")} />
              </div>
            )}

            {company.phone && (
              <div className="flex items-center gap-2.5 py-1.5 text-[13px]">
                <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                <span className="text-gray-900">{company.phone}</span>
                <CopyButton value={company.phone} label={t("companyChip.copy")} />
              </div>
            )}

            {company.address && (
              <div className="flex items-center gap-2.5 py-1.5 text-[13px]">
                <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="text-gray-900">{company.address}</span>
                <CopyButton value={company.address} label={t("companyChip.copy")} />
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
