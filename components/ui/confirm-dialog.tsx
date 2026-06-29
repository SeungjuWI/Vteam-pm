"use client";

/**
 * Toss-toned confirm dialog — replaces native window.confirm().
 *
 * Imperative + Promise-based so call sites barely change:
 *   if (!confirm("삭제할까요?")) return;
 *   →  if (!(await confirmDialog("삭제할까요?"))) return;
 *
 * A single <ConfirmRoot /> mounted in the root layout renders the active
 * request and resolves the awaiting promise on confirm/cancel.
 */
import * as React from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export interface ConfirmOptions {
  /** Bold heading line. Defaults to "확인". */
  title?: string;
  /** Body copy. Can be passed positionally as the first arg too. */
  message?: string;
  /** Confirm button label. Defaults to "확인". */
  confirmText?: string;
  /** Cancel button label. Defaults to "취소". */
  cancelText?: string;
  /** Red destructive styling for the confirm button. */
  danger?: boolean;
}

interface ActiveRequest extends ConfirmOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

type Listener = (req: ActiveRequest | null) => void;

let current: ActiveRequest | null = null;
let seq = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(current);
}

function settle(ok: boolean) {
  if (!current) return;
  current.resolve(ok);
  current = null;
  emit();
}

/**
 * Open a confirm dialog. Resolves true on confirm, false on cancel/dismiss.
 * Accepts a plain message string or a full options object.
 */
export function confirmDialog(
  opts: string | ConfirmOptions
): Promise<boolean> {
  const options = typeof opts === "string" ? { message: opts } : opts;
  // If one is already open, resolve it as cancelled before replacing.
  if (current) settle(false);
  return new Promise<boolean>((resolve) => {
    current = { id: ++seq, resolve, ...options };
    emit();
  });
}

/** Mount once near the root. */
export function ConfirmRoot() {
  const [req, setReq] = React.useState<ActiveRequest | null>(null);

  React.useEffect(() => {
    listeners.add(setReq);
    setReq(current);
    return () => {
      listeners.delete(setReq);
    };
  }, []);

  // Esc to cancel, Enter to confirm.
  React.useEffect(() => {
    if (!req) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") settle(false);
      else if (e.key === "Enter") settle(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req]);

  if (!req) return null;

  const title = req.title ?? "확인";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-gray-900/40 animate-[overlay-in_0.18s_ease-out]"
        onClick={() => settle(false)}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className={cn(
          "relative w-full max-w-[340px] rounded-2xl bg-white p-6 shadow-soft-xl",
          "animate-[confirm-pop_0.22s_cubic-bezier(0.16,1,0.3,1)]"
        )}
      >
        <style>{`@keyframes confirm-pop{from{opacity:0;transform:translateY(8px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
        <h2 className="text-card-title text-gray-900">{title}</h2>
        {req.message && (
          <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-gray-600">
            {req.message}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => settle(false)}
          >
            {req.cancelText ?? "취소"}
          </Button>
          <Button
            variant={req.danger ? "destructive" : "primary"}
            className="flex-1"
            autoFocus
            onClick={() => settle(true)}
          >
            {req.confirmText ?? "확인"}
          </Button>
        </div>
      </div>
    </div>
  );
}
