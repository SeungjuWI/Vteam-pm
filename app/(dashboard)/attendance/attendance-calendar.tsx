"use client";

import { useState, useMemo, useEffect } from "react";

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
const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
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

function formatHM(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}시간 ${m}분`;
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
  isLeave: boolean;
  leaveType: string | null;
  isToday: boolean;
  isCurrentMonth: boolean;
  isOvertime: boolean;
};

export default function AttendanceCalendar({ records, leaves, requiredHours }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [baseDate, setBaseDate] = useState(new Date());
  const [now, setNow] = useState(0);
  const mounted = now > 0;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // 마운트 후 현재 시간 설정 + 근무 중이면 1분마다 갱신
  const hasActiveRecord = records.some((r) => !r.clock_out);
  useEffect(() => {
    setNow(Date.now());
    if (!hasActiveRecord) return;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [hasActiveRecord]);

  const requiredMs = requiredHours * 3600000;

  // Build a map of date -> day info
  const dayMap = useMemo(() => {
    const map = new Map<string, { totalMs: number; isWorking: boolean }>();

    for (const r of records) {
      const clockIn = new Date(r.clock_in);
      const key = `${clockIn.getFullYear()}-${clockIn.getMonth()}-${clockIn.getDate()}`;
      const end = r.clock_out ? new Date(r.clock_out).getTime() : (now || clockIn.getTime());
      const ms = end - clockIn.getTime();
      const existing = map.get(key);
      if (existing) {
        existing.totalMs += ms;
        if (!r.clock_out) existing.isWorking = true;
      } else {
        map.set(key, { totalMs: ms, isWorking: !r.clock_out });
      }
    }
    return map;
  }, [records, now]);

  // Build leave map
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
      isLeave: !!leave,
      leaveType: leave?.type ?? null,
      isToday: isSameDay(date, today),
      isCurrentMonth: date.getMonth() === baseDate.getMonth(),
      isOvertime: totalMs > requiredMs,
    };
  }

  // Get calendar days
  const calendarDays = useMemo((): DayInfo[][] => {
    if (viewMode === "week") {
      const monday = getMonday(baseDate);
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
      const calStart = getMonday(monthStart);
      const weeks: DayInfo[][] = [];
      let current = new Date(calStart);

      while (current <= monthEnd || current.getDay() !== 1) {
        const week: DayInfo[] = [];
        for (let i = 0; i < 7; i++) {
          week.push(getDayInfo(current));
          current.setDate(current.getDate() + 1);
        }
        weeks.push(week);
        if (current > monthEnd && current.getDay() === 1) break;
      }
      return weeks;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, baseDate, dayMap, leaveMap, requiredMs, today]);

  // Weekly stats (for the week containing baseDate)
  const weekStats = useMemo(() => {
    const monday = getMonday(baseDate);
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
        const mon = getMonday(baseDate);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return `${mon.getMonth() + 1}/${mon.getDate()} ~ ${sun.getMonth() + 1}/${sun.getDate()}`;
      })()
    : `${baseDate.getFullYear()}년 ${baseDate.getMonth() + 1}월`;

  const leaveLabel = (type: string | null) => {
    const map: Record<string, string> = {
      annual: "연차",
      half_am: "오전반차",
      half_pm: "오후반차",
      sick: "병가",
      condolence: "경조",
      maternity: "출산",
      paternity: "배우자출산",
      family_care: "가족돌봄",
      compensatory: "대체휴무",
      other: "기타",
    };
    return type ? map[type] ?? "휴가" : "휴가";
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setViewMode("week")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "week" ? "bg-white text-gray-900" : "text-gray-500"
              }`}
            >
              주
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "month" ? "bg-white text-gray-900" : "text-gray-500"
              }`}
            >
              월
            </button>
          </div>
          <button
            onClick={goToday}
            className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            오늘
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

      {/* Weekly Summary */}
      <div className="rounded-xl bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">이번 주 총 근무시간</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{formatHM(weekStats.totalMs)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">법정 기준 (주 {LEGAL_WEEKLY_HOURS}시간)</p>
            <p className={`mt-1 text-sm font-medium ${
              weekStats.diff > 0 ? "text-blue-500" : weekStats.diff < 0 ? "text-gray-400" : "text-gray-600"
            }`}>
              {weekStats.diff === 0
                ? "정확히 달성"
                : weekStats.diff > 0
                  ? `${formatHM(weekStats.diff)} 초과 달성`
                  : `${formatHM(Math.abs(weekStats.diff))} 부족`}
            </p>
            {weekStats.totalMs > weekStats.maxMs && (
              <p className="mt-0.5 text-xs text-red-500">⚠ 주 {MAX_WEEKLY_HOURS}시간 초과</p>
            )}
          </div>
        </div>
        {/* Progress bar */}
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

      {/* Calendar Grid */}
      <div className="rounded-xl bg-white">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`py-2.5 text-center text-xs font-medium ${
                i === 5 ? "text-blue-400" : i === 6 ? "text-red-400" : "text-gray-500"
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {calendarDays.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-50 last:border-b-0">
            {week.map((day, di) => {
              const isWeekend = di >= 5;
              const dimmed = !day.isCurrentMonth && viewMode === "month";

              return (
                <div
                  key={di}
                  className={`min-h-[90px] border-r border-gray-50 p-2 last:border-r-0 ${
                    day.isToday ? "bg-blue-50/50" : dimmed ? "bg-gray-50/50" : ""
                  }`}
                >
                  {/* Date number */}
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs ${
                        day.isToday
                          ? "flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white"
                          : isWeekend
                            ? di === 5 ? "text-blue-400" : "text-red-400"
                            : dimmed ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      {day.date.getDate()}
                    </span>
                    {day.isOvertime && !day.isLeave && <span className="text-xs">🔥</span>}
                  </div>

                  {/* Content */}
                  {day.isLeave ? (
                    <div className="mt-1.5">
                      <span className="inline-block rounded-md bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
                        {leaveLabel(day.leaveType)}
                      </span>
                      <p className="mt-0.5 text-[10px] text-gray-400">8시간</p>
                    </div>
                  ) : day.isWorking ? (
                    <div className="mt-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
                        <span className="h-1 w-1 rounded-full bg-blue-500" />
                        근무중
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
