"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { logout } from "@/app/(auth)/actions";
import { useT } from "@/lib/i18n";

interface ProfileData {
  name: string;
  role: string;
  position: string;
  avatarUrl: string;
  email: string;
}

export default function ProfileMenu({ profile }: { profile: ProfileData }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const ROLE_KEYS = { admin: "role.admin", employee: "role.employee" } as const;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((prev) => !prev);
  }

  const roleKey = profile.role as keyof typeof ROLE_KEYS;
  const roleLabel = roleKey in ROLE_KEYS ? t(ROLE_KEYS[roleKey]) : profile.role;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 transition-colors hover:ring-2 hover:ring-gray-200"
      >
        {profile.avatarUrl ? (
          <Image src={profile.avatarUrl} alt={profile.name} width={32} height={32} className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-medium text-gray-500">{profile.name[0]}</span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-64 rounded-2xl border border-gray-200 bg-white py-3"
          style={{ top: pos.top, right: pos.right }}
        >
          <div className="px-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                {profile.avatarUrl ? (
                  <Image src={profile.avatarUrl} alt={profile.name} width={40} height={40} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-medium text-gray-500">{profile.name[0]}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{profile.name}</p>
                <p className="truncate text-xs text-gray-500">{roleLabel}</p>
                {profile.position && <p className="truncate text-xs text-gray-400">{profile.position}</p>}
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          <div className="py-1">
            <button
              onClick={() => { setOpen(false); router.push("/settings"); }}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {t("profileMenu.myProfile")}
            </button>
          </div>

          <div className="h-px bg-gray-100" />

          <div className="pt-1">
            <button
              onClick={() => logout()}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-500 transition-colors hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              {t("profileMenu.logout")}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
