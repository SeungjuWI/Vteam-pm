"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function NotificationButton() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-72 rounded-2xl border border-gray-200 bg-white"
          style={{ top: pos.top, right: pos.right }}
        >
          <div className="px-4 py-3">
            <p className="text-sm font-medium text-gray-900">알림</p>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex items-center justify-center px-4 py-10">
            <p className="text-sm text-gray-400">새로운 알림이 없습니다</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
