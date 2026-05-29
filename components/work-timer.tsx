"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { clockIn, clockOut, getAttendanceStatus } from "@/app/(dashboard)/attendance/actions";
import { useT } from "@/lib/i18n";

type WorkStatus = "idle" | "working" | "done";

const CONFETTI_COLORS = ["#3B82F6", "#60A5FA", "#93C5FD", "#FBBF24", "#F59E0B", "#34D399", "#FB7185"];

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w;
    canvas.height = h;

    const pieces = Array.from({ length: 40 }, () => ({
      x: w / 2,
      y: h / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -10 - 2,
      size: Math.random() * 6 + 3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
    }));

    let frame: number;
    function animate() {
      ctx!.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of pieces) {
        p.x += p.vx;
        p.vy += 0.25;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.012;
        if (p.opacity <= 0) continue;
        alive = true;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.globalAlpha = p.opacity;
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx!.restore();
      }
      if (alive) frame = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

export default function WorkTimer({
  initialStatus,
}: {
  initialStatus: { status: WorkStatus; clockIn: string | null };
}) {
  const t = useT();
  const [status, setStatus] = useState<WorkStatus>(initialStatus.status);
  const [clockInTime, setClockInTime] = useState<string | null>(initialStatus.clockIn);
  const [loading, setLoading] = useState(false);
  const [modalStep, setModalStep] = useState<"confirm" | "summary" | null>(null);
  const [totalDuration, setTotalDuration] = useState("");
  const [clockOutTimeStr, setClockOutTimeStr] = useState("");
  const [clockInTimeStr, setClockInTimeStr] = useState("");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function formatDuration(ms: number): string {
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h}${t("common.hours")} ${m}${t("common.minutes")}`;
    return `${m}${t("common.minutes")}`;
  }

  const fetchStatus = useCallback(async () => {
    const result = await getAttendanceStatus();
    if (!result) return;
    setStatus(result.status);
    setClockInTime(result.clockIn);
  }, []);

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

  function handleToggleMenu() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((prev) => !prev);
  }

  async function handleClockIn() {
    setLoading(true);
    const result = await clockIn();
    if (result?.error) {
      alert(result.error);
    } else {
      await fetchStatus();
    }
    setLoading(false);
    setOpen(false);
  }

  function handleClockOutClick() {
    if (!clockInTime) return;
    const now = Date.now();
    const duration = now - new Date(clockInTime).getTime();
    setClockInTimeStr(new Date(clockInTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
    setClockOutTimeStr(new Date(now).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
    setTotalDuration(formatDuration(duration));
    setModalStep("confirm");
    setOpen(false);
  }

  async function handleClockOutConfirm() {
    setLoading(true);
    const result = await clockOut();
    if (result?.error) {
      alert(result.error);
      setModalStep(null);
    } else {
      await fetchStatus();
      setModalStep("summary");
    }
    setLoading(false);
  }

  const isWorking = status === "working";

  return (
    <>
      <div
        ref={btnRef}
        onClick={handleToggleMenu}
        className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 transition-colors ${
          isWorking
            ? "border-blue-200 bg-blue-50"
            : "border-gray-200 bg-white hover:bg-gray-50"
        }`}
      >
        {isWorking ? (
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-gray-300" />
        )}
        <span className={`text-sm ${isWorking ? "text-blue-600" : "text-gray-500"}`}>
          {isWorking ? t("timer.working") : status === "done" ? t("timer.doneForDay") : t("timer.beforeWork")}
        </span>
      </div>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-56 rounded-2xl border border-gray-200 bg-white py-2"
          style={{ top: pos.top, right: pos.right }}
        >
          <div className="px-4 py-2">
            {isWorking && clockInTime ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{t("timer.clockInLabel")}</span>
                  <span className="text-sm text-gray-900">
                    {new Date(clockInTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="mt-1 text-xs text-blue-500">
                  {formatDuration(Date.now() - new Date(clockInTime).getTime())} {t("timer.working")}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-400">{t("timer.workLabel")}</p>
                <p className="mt-1 text-sm text-gray-900">
                  {status === "done" ? t("timer.doneToday") : t("timer.notYet")}
                </p>
              </>
            )}
          </div>
          <div className="h-px bg-gray-100" />
          <div className="py-1">
            {status === "idle" && (
              <button
                onClick={handleClockIn}
                disabled={loading}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                {t("timer.doClockIn")}
              </button>
            )}
            {isWorking && (
              <button
                onClick={handleClockOutClick}
                disabled={loading}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                </svg>
                {t("timer.doClockOut")}
              </button>
            )}
            {status === "done" && (
              <p className="px-4 py-2 text-sm text-gray-400">{t("timer.doneMessage")}</p>
            )}
          </div>
        </div>,
        document.body
      )}

      {modalStep === "confirm" && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setModalStep(null)} />
          <div className="relative w-80 rounded-2xl bg-white p-6">
            <h3 className="text-center text-base font-medium text-gray-900">{t("timer.confirmClockOut")}</h3>
            <div className="mt-4 space-y-2 rounded-xl bg-gray-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t("timer.clockInLabel")}</span>
                <span className="text-sm text-gray-900">{clockInTimeStr}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t("timer.now")}</span>
                <span className="text-sm text-gray-900">{clockOutTimeStr}</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t("timer.totalHours")}</span>
                <span className="text-sm font-medium text-blue-600">{totalDuration}</span>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setModalStep(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleClockOutConfirm}
                disabled={loading}
                className="flex-1 rounded-xl bg-blue-500 py-2.5 text-sm text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
              >
                {t("timer.doClockOut")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {modalStep === "summary" && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setModalStep(null)} />
          <div className="relative w-80 overflow-hidden rounded-2xl bg-white p-6">
            <Confetti />
            <h3 className="text-center text-base font-medium text-gray-900">{t("timer.clockOutDone")}</h3>
            <div className="mt-4 space-y-2 rounded-xl bg-gray-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t("timer.clockInLabel")}</span>
                <span className="text-sm text-gray-900">{clockInTimeStr}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t("timer.doClockOut")}</span>
                <span className="text-sm text-gray-900">{clockOutTimeStr}</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t("timer.totalHours")}</span>
                <span className="text-sm font-medium text-blue-600">{totalDuration}</span>
              </div>
            </div>
            <button
              onClick={() => setModalStep(null)}
              className="mt-5 w-full rounded-xl bg-blue-500 py-2.5 text-sm text-white transition-colors hover:bg-blue-600"
            >
              {t("timer.goodJob")}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
