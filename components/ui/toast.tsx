"use client";

/**
 * Toss-toned toast system — replaces native alert().
 *
 * Imperative singleton API so any module (even non-React code) can call
 * `toast.error("...")` without hooks. A single <Toaster /> mounted in the
 * root layout subscribes to the store and renders the stack.
 */
import * as React from "react";
import { cn } from "@/lib/cn";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let seq = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l([...toasts]);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastKind, message: string, duration = 3200) {
  const id = ++seq;
  toasts = [...toasts, { id, kind, message }];
  emit();
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

/** Fire a toast from anywhere. `toast("msg")` defaults to info. */
export const toast = Object.assign(
  (message: string) => push("info", message),
  {
    success: (message: string) => push("success", message),
    error: (message: string) => push("error", message),
    info: (message: string) => push("info", message),
    dismiss,
  }
);

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0">
      <circle cx="10" cy="10" r="10" fill="#1D9E75" />
      <path d="M6 10.2l2.6 2.6L14 7.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0">
      <circle cx="10" cy="10" r="10" fill="#F04452" />
      <path d="M10 5.5v5.2M10 13.8h.01" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0">
      <circle cx="10" cy="10" r="10" fill="#3182F6" />
      <path d="M10 9v5M10 6.2h.01" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

function ToastCard({ item }: { item: ToastItem }) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 rounded-2xl border border-gray-100 bg-white",
        "px-4 py-3 shadow-soft-lg",
        "animate-[toast-in_0.22s_cubic-bezier(0.16,1,0.3,1)]"
      )}
      role="status"
    >
      {ICONS[item.kind]}
      <p className="pt-0.5 text-[13.5px] font-medium leading-snug text-gray-800 break-words">
        {item.message}
      </p>
      <button
        onClick={() => dismiss(item.id)}
        className="ml-1 shrink-0 rounded-md p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        aria-label="닫기"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/** Mount once near the root. Renders the toast stack in the bottom-center. */
export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    listeners.add(setItems);
    setItems([...toasts]);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return (
    <>
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(12px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}
