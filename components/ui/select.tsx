"use client";

/**
 * Toss-toned custom dropdown — replaces native <select>.
 *
 * Controlled API close to the native element to keep migrations small:
 *   <Select value={v} onChange={setV} options={[{value,label}, ...]} />
 *
 * The menu renders in a fixed-position layer measured from the trigger, so it
 * never clips inside scrollable modals. Closes on outside click, scroll,
 * resize, or Escape. Full keyboard nav (↑/↓/Home/End/Enter/Esc).
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Extra classes for the trigger button. */
  className?: string;
  /** Trigger height. Defaults to "md" (h-9). */
  size?: "sm" | "md";
  "aria-label"?: string;
}

const TRIGGER_SIZE = {
  sm: "h-8 text-[12px] px-2.5",
  md: "h-9 text-[13px] px-3",
};

export function Select({
  value,
  onChange,
  options,
  placeholder = "선택",
  disabled,
  className,
  size = "md",
  "aria-label": ariaLabel,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<{ left: number; top: number; bottom: number; width: number } | null>(null);
  const [active, setActive] = React.useState(0);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const measure = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.top, bottom: r.bottom, width: r.width });
  }, []);

  const openMenu = React.useCallback(() => {
    if (disabled) return;
    measure();
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }, [disabled, measure, options, value]);

  // Close on outside interaction.
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onScrollOrResize() {
      setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  function pick(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[active];
      if (opt) pick(opt);
    }
  }

  // Decide drop direction: if not enough room below, open upward.
  const dropUp =
    open && rect ? window.innerHeight - rect.bottom < 240 && rect.top > 240 : false;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white",
          "font-medium text-gray-800 shadow-soft-xs transition-colors",
          "hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          TRIGGER_SIZE[size],
          className
        )}
      >
        <span className={cn("truncate", !selected && "text-gray-400")}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          viewBox="0 0 16 16"
          className={cn("h-4 w-4 shrink-0 text-gray-400 transition-transform", open && "rotate-180")}
          fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && rect && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          style={{
            position: "fixed",
            left: rect.left,
            width: rect.width,
            ...(dropUp
              ? { bottom: window.innerHeight - rect.top + 6 }
              : { top: rect.bottom + 6 }),
          }}
          className={cn(
            "z-[120] max-h-60 overflow-auto rounded-xl border border-gray-100 bg-white p-1 shadow-soft-lg scrollbar-thin",
            "animate-[select-pop_0.16s_cubic-bezier(0.16,1,0.3,1)]"
          )}
        >
          <style>{`@keyframes select-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === active;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(opt)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                  isActive ? "bg-gray-100 text-gray-900" : "text-gray-700",
                  isSelected && "text-blue-600"
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-blue-500" fill="none">
                    <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
