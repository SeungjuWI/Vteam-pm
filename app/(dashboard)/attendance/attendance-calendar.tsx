"use client";

import { useState, useMemo, useEffect } from "react";
import { useT } from "@/lib/i18n";

type AttendanceRecord = {
  clock_in: string;
  clock_out: string | null;
};

type LeaveRecord = {
  start_date: string;
  end_date: string;
  type: string;
  status: string;
  duration_hours: number;
};

type Props = {
  records: AttendanceRecord[];
  leaves: LeaveRecord[];
  requiredHours: number;
};

type ViewMode = "week" | "month";

const LEGAL_WEEKLY_HOURS = 40;
const MAX_WEEKLY_HOURS = 52;

function getSunday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatHMShort(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

type DayInfo = {
  date: Date;
  totalMs: number;
  isWorking: boolean;
  isMissing: boolean;
  isLeave: boolean;
  leaveType: string | null;
  isToday: boolean;
  isCurrentMonth: boolean;
  isOvertime: boolean;
};

export default function AttendanceCalendar({ records, leaves, requiredHours }: Props) {
  const t = useT();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [baseDate, setBaseDate] = useState(new Date());
  const [now, setNow] = useState(0);

  const DAY_NAMES = t("calendar.dayNames").split(",");

  function formatHM(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}${t("common.hours")} ${m}${t("common.minutes")}`;
  }

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const hasActiveRecord = records.some((r) => !r.clock_out);
  useEffect(() => {
    setNow(Date.now());
    if (!hasActiveRecord) return;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [hasActiveRecord]);

  const requiredMs = requiredHours * 3600000;

  const dayMap = useMemo(() => {
    const map = new Map<string, { totalMs: number; isWorking: boolean; isMissing: boolean }>();
    for (const r of records) {
      const clockIn = new Date(r.clock_in);
      const key = `${clockIn.getFullYear()}-${clockIn.getMonth()}-${clockIn.getDate()}`;
      const dayStart = new Date(clockIn);
      dayStart.setHours(0, 0, 0, 0);
      const open = !r.clock_out;
      // 오늘 열린 기록은 현재 근무중, 지난 날짜의 열린 기록은 퇴근 누락.
      const isPastOpen = open && dayStart.getTime() < today.getTime();
      // 퇴근 누락은 종료시각을 알 수 없으므로 근무시간을 합산하지 않는다(주간 합계 부풀림 방지).
      const end = r.clock_out
        ? new Date(r.clock_out).getTime()
        : isPastOpen
          ? clockIn.getTime()
          : (now || clockIn.getTime());
      const ms = end - clockIn.getTime();
      const existing = map.get(key);
      if (existing) {
        existing.totalMs += ms;
        if (open && !isPastOpen) existing.isWorking = true;
        if (isPastOpen) existing.isMissing = true;
      } else {
        map.set(key, { totalMs: ms, isWorking: open && !isPastOpen, isMissing: isPastOpen });
      }
    }
    return map;
  }, [records, now, today]);

  const leaveMap = useMemo(() => {
    const map = new Map<string, { type: string; hours: number }>();
    for (const l of leaves) {
      if (l.status !== "approved") continue;
      const start = new Date(l.start_date);
      const end = new Date(l.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        map.set(key, { type: l.type, hours: l.duration_hours });
      }
    }
    return map;
  }, [leaves]);

  function getDayInfo(date: Date): DayInfo {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const attendance = dayMap.get(key);
    const leave = leaveMap.get(key);
    const totalMs = attendance?.totalMs ?? (leave ? leave.hours * 3600000 : 0);
    return {
      date: new Date(date),
      totalMs,
      isWorking: attendance?.isWorking ?? false,
      isMissing: attendance?.isMissing ?? false,
      isLeave: !!leave,
      leaveType: leave?.type ?? null,
      isToday: isSameDay(date, today),
      isCurrentMonth: date.getMonth() === baseDate.getMonth(),
      isOvertime: totalMs > requiredMs,
    };
  }

  const calendarDays = useMemo((): DayInfo[][] => {
    if (viewMode === "week") {
      const monday = getSunday(baseDate);
      const week: DayInfo[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        week.push(getDayInfo(d));
      }
      return [week];
    } else {
      const monthStart = getMonthStart(baseDate);
      const monthEnd = getMonthEnd(baseDate);
      const calStart = getSunday(monthStart);
      const weeks: DayInfo[][] = [];
      let current = new Date(calStart);
      while (current <= monthEnd || current.getDay() !== 0) {
        const week: DayInfo[] = [];
        for (let i = 0; i < 7; i++) {
          week.push(getDayInfo(current));
          current.setDate(current.getDate() + 1);
        }
        weeks.push(week);
        if (current > monthEnd && current.getDay() === 0) break;
      }
      return weeks;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, baseDate, dayMap, leaveMap, requiredMs, today]);

  const weekStats = useMemo(() => {
    const monday = getSunday(baseDate);
    let totalMs = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const info = getDayInfo(d);
      totalMs += info.totalMs;
    }
    const legalMs = LEGAL_WEEKLY_HOURS * 3600000;
    const maxMs = MAX_WEEKLY_HOURS * 3600000;
    const diff = totalMs - legalMs;
    return { totalMs, legalMs, maxMs, diff };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseDate, dayMap, leaveMap, requiredMs]);

  function navigate(dir: -1 | 1) {
    setBaseDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "week") {
        d.setDate(d.getDate() + dir * 7);
      } else {
        d.setMonth(d.getMonth() + dir);
      }
      return d;
    });
  }

  function goToday() {
    setBaseDate(new Date());
  }

  const headerLabel = viewMode === "week"
    ? (() => {
        const sun = getSunday(baseDate);
        const sat = new Date(sun);
        sat.setDate(sun.getDate() + 6);
        return `${sun.getMonth() + 1}/${sun.getDate()} ~ ${sat.getMonth() + 1}/${sat.getDate()}`;
      })()
    : `${baseDate.getFullYear()}. ${baseDate.getMonth() + 1}`;

  const leaveLabel = (type: string | null) => {
    const map: Record<string, string> = {
      annual: t("leaveType.annual"),
      half_am: t("calendar.halfAm"),
      half_pm: t("calendar.halfPm"),
      sick: t("calendar.sickLeave"),
      condolence: t("calendar.condolence"),
      maternity: t("calendar.maternity"),
      paternity: t("calendar.paternity"),
      family_care: t("calendar.familyCare"),
      compensatory: t("calendar.compensatory"),
      other: t("calendar.otherLeave"),
    };
    return type ? map[type] ?? t("calendar.leave") : t("calendar.leave");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setViewMode("week")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "week" ? "bg-white text-gray-900" : "text-gray-500"
              }`}
            >
              {t("calendar.week")}
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "month" ? "bg-white text-gray-900" : "text-gray-500"
              }`}
            >
              {t("calendar.month")}
            </button>
          </div>
          <button
            onClick={goToday}
            className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            {t("calendar.today")}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-gray-900">{headerLabel}</span>
          <button onClick={() => navigate(1)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{t("calendar.weeklyTotal")}</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{formatHM(weekStats.totalMs)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{t("calendar.legalBasis")} ({LEGAL_WEEKLY_HOURS}h)</p>
            <p className={`mt-1 text-sm font-medium ${
              weekStats.diff > 0 ? "text-blue-500" : weekStats.diff < 0 ? "text-gray-400" : "text-gray-600"
            }`}>
              {weekStats.diff === 0
                ? t("calendar.exactlyMet")
                : weekStats.diff > 0
                  ? `${formatHM(weekStats.diff)} ${t("calendar.exceeded")}`
                  : `${formatHM(Math.abs(weekStats.diff))} ${t("calendar.shortage")}`}
            </p>
            {weekStats.totalMs > weekStats.maxMs && (
              <p className="mt-0.5 text-xs text-red-500">⚠ {MAX_WEEKLY_HOURS}h {t("calendar.overLimit")}</p>
            )}
          </div>
        </div>
        <div className="mt-3">
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className={`h-2 rounded-full transition-all ${
                weekStats.totalMs > weekStats.maxMs
                  ? "bg-red-400"
                  : weekStats.totalMs >= weekStats.legalMs
                    ? "bg-blue-400"
                    : "bg-gray-300"
              }`}
              style={{ width: `${Math.min((weekStats.totalMs / weekStats.maxMs) * 100, 100)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-400">
            <span>0h</span>
            <span className="relative">
              <span className="absolute -translate-x-1/2">{LEGAL_WEEKLY_HOURS}h</span>
            </span>
            <span>{MAX_WEEKLY_HOURS}h</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`py-2.5 text-center text-xs font-medium ${
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-500"
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {calendarDays.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-50 last:border-b-0">
            {week.map((day, di) => {
              const isWeekend = di === 0 || di === 6;
              const dimmed = !day.isCurrentMonth && viewMode === "month";

              return (
                <div
                  key={di}
                  className={`min-h-[90px] border-r border-gray-50 p-2 last:border-r-0 ${
                    day.isToday ? "bg-blue-50/50" : dimmed ? "bg-gray-50/50" : ""
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs ${
                        day.isToday
                          ? "flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white"
                          : isWeekend
                            ? di === 0 ? "text-red-400" : "text-blue-400"
                            : dimmed ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      {day.date.getDate()}
                    </span>
                    {day.isOvertime && !day.isLeave && <span className="text-xs">🔥</span>}
                  </div>

                  {day.isLeave ? (
                    <div className="mt-1.5">
                      <span className="inline-block rounded-md bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
                        {leaveLabel(day.leaveType)}
                      </span>
                      <p className="mt-0.5 text-[10px] text-gray-400">8h</p>
                    </div>
                  ) : day.isMissing ? (
                    <div className="mt-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                        <span className="h-1 w-1 rounded-full bg-amber-500" />
                        {t("calendar.missingCheckout")}
                      </span>
                    </div>
                  ) : day.isWorking ? (
                    <div className="mt-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
                        <span className="h-1 w-1 rounded-full bg-blue-500" />
                        {t("clock.working")}
                      </span>
                      <p className="mt-0.5 text-[10px] text-gray-400">{formatHMShort(day.totalMs)}</p>
                    </div>
                  ) : day.totalMs > 0 ? (
                    <div className="mt-1.5">
                      <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                        day.isOvertime ? "bg-red-50 text-red-400" : "bg-green-50 text-green-600"
                      }`}>
                        {formatHMShort(day.totalMs)}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
