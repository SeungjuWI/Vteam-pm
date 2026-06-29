"use client";

/**
 * Toss-toned calendar — replaces native <input type="date"> and
 * <input type="datetime-local">.
 *
 *   <DatePicker value="2026-06-29" onChange={setV} />
 *   <DateTimePicker value="2026-06-29T09:30" onChange={setV} />
 *
 * Values use the same string formats the native inputs produce, so call sites
 * keep their existing state shape. The popover renders fixed-position so it
 * never clips inside scrollable modals.
 */
import * as React from "react";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Parse "yyyy-mm-dd" without timezone drift. */
function parseDate(v: string | undefined): { y: number; m: number; d: number } | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function isWithin(dateStr: string, min?: string, max?: string) {
  if (min && dateStr < min) return false;
  if (max && dateStr > max) return false;
  return true;
}

/* ── shared popover positioning ── */
function useAnchoredPopover(open: boolean, onClose: () => void) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  const measure = React.useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  React.useEffect(() => {
    if (!open) return;
    measure();
    function onDown(e: MouseEvent) {
      if (
        !popRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      )
        onClose();
    }
    function onScroll() {
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, measure, onClose]);

  return { triggerRef, popRef, rect };
}

/* ── calendar grid ── */
function Calendar({
  value,
  onPick,
  min,
  max,
}: {
  value: string | undefined;
  onPick: (v: string) => void;
  min?: string;
  max?: string;
}) {
  const sel = parseDate(value);
  const today = new Date();
  const init = sel ?? { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() };
  const [view, setView] = React.useState({ y: init.y, m: init.m });

  const first = new Date(view.y, view.m - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(view.y, view.m, 0).getDate();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function shift(delta: number) {
    setView((v) => {
      const m = v.m + delta;
      if (m < 1) return { y: v.y - 1, m: 12 };
      if (m > 12) return { y: v.y + 1, m: 1 };
      return { y: v.y, m };
    });
  }

  return (
    <div className="w-[268px] p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
          aria-label="이전 달"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
            <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-[13.5px] font-bold text-gray-900 tabular-nums">
          {view.y}년 {view.m}월
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
          aria-label="다음 달"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cn(
              "py-1 text-center text-[11px] font-bold",
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-500" : "text-gray-400"
            )}
          >
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const ds = toDateStr(view.y, view.m, d);
          const disabled = !isWithin(ds, min, max);
          const isSel = sel && sel.y === view.y && sel.m === view.m && sel.d === d;
          const isToday = ds === todayStr;
          const dow = (startPad + d - 1) % 7;
          return (
            <button
              key={ds}
              type="button"
              disabled={disabled}
              onClick={() => onPick(ds)}
              className={cn(
                "mx-auto my-0.5 flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-medium tabular-nums transition-colors",
                "disabled:cursor-not-allowed disabled:text-gray-300",
                isSel
                  ? "bg-blue-500 text-white shadow-soft-sm"
                  : cn(
                      "hover:bg-gray-100",
                      dow === 0 ? "text-red-400" : dow === 6 ? "text-blue-500" : "text-gray-700"
                    ),
                isToday && !isSel && "ring-1 ring-inset ring-blue-200"
              )}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TRIGGER_BASE =
  "inline-flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 " +
  "font-medium shadow-soft-xs transition-colors hover:bg-gray-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-gray-400" fill="none">
      <rect x="2.5" y="3" width="11" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 6.5h11M5.5 1.8v2.4M10.5 1.8v2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "날짜 선택",
  disabled,
  className,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const { triggerRef, popRef, rect } = useAnchoredPopover(open, close);

  const p = parseDate(value);
  const display = p ? `${p.y}.${pad(p.m)}.${pad(p.d)}` : placeholder;
  const dropUp = open && rect ? window.innerHeight - rect.bottom < 360 && rect.top > 360 : false;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cn(TRIGGER_BASE, "h-9 text-[13px]", className)}
      >
        <span className={cn("tabular-nums", !p && "text-gray-400")}>{display}</span>
        <CalendarIcon />
      </button>
      {open && rect && (
        <div
          ref={popRef}
          style={{
            position: "fixed",
            left: Math.min(rect.left, window.innerWidth - 284),
            ...(dropUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
          }}
          className="z-[120] rounded-2xl border border-gray-100 bg-white shadow-soft-lg animate-[select-pop_0.16s_cubic-bezier(0.16,1,0.3,1)]"
        >
          <Calendar
            value={value}
            min={min}
            max={max}
            onPick={(v) => {
              onChange(v);
              setOpen(false);
            }}
          />
        </div>
      )}
    </>
  );
}

/* ── datetime-local replacement ── */
function parseDateTime(v: string | undefined) {
  if (!v) return { date: "", h: 9, min: 0 };
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return { date: "", h: 9, min: 0 };
  return { date: m[1], h: +m[2], min: +m[3] };
}

export interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function DateTimePicker({
  value,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const { triggerRef, popRef, rect } = useAnchoredPopover(open, close);

  const { date, h, min } = parseDateTime(value);

  function commit(nd: string, nh: number, nm: number) {
    if (!nd) return;
    onChange(`${nd}T${pad(nh)}:${pad(nm)}`);
  }

  const p = parseDate(date);
  const display = p ? `${p.y}.${pad(p.m)}.${pad(p.d)} ${pad(h)}:${pad(min)}` : "날짜·시간 선택";
  const dropUp = open && rect ? window.innerHeight - rect.bottom < 420 && rect.top > 420 : false;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cn(TRIGGER_BASE, "h-9 text-[13px]", className)}
      >
        <span className={cn("tabular-nums", !p && "text-gray-400")}>{display}</span>
        <CalendarIcon />
      </button>
      {open && rect && (
        <div
          ref={popRef}
          style={{
            position: "fixed",
            left: Math.min(rect.left, window.innerWidth - 284),
            ...(dropUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
          }}
          className="z-[120] rounded-2xl border border-gray-100 bg-white shadow-soft-lg animate-[select-pop_0.16s_cubic-bezier(0.16,1,0.3,1)]"
        >
          <Calendar value={date} onPick={(v) => commit(v, h, min)} />
          <div className="flex items-center gap-2 border-t border-gray-100 px-3 py-2.5">
            <span className="text-[12px] font-semibold text-gray-500">시간</span>
            <TimeSpinner value={h} max={23} onChange={(nh) => commit(date, nh, min)} />
            <span className="text-gray-400">:</span>
            <TimeSpinner value={min} max={59} onChange={(nm) => commit(date, h, nm)} />
          </div>
        </div>
      )}
    </>
  );
}

function TimeSpinner({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={pad(value)}
      onChange={(e) => {
        const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
        if (!isNaN(n) && n >= 0 && n <= max) onChange(n);
        else if (e.target.value === "") onChange(0);
      }}
      className="w-10 rounded-lg border border-gray-200 bg-white py-1 text-center text-[13px] font-semibold tabular-nums text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
    />
  );
}
