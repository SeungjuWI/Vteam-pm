"use client";

import { useState } from "react";
import Avatar from "@/components/avatar";
import { useT } from "@/lib/i18n";

type TeamRecord = {
  name: string;
  email: string;
  avatarUrl: string | null;
  position: string | null;
  clockIn: string;
  clockOut: string | null;
};

type AbsentMember = {
  name: string;
  avatarUrl: string | null;
  position: string | null;
};

const HOUR_START = 7;
const HOUR_END = 22;
const TOTAL_HOURS = HOUR_END - HOUR_START;

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getBarStyle(clockIn: string, clockOut: string | null) {
  const startDate = new Date(clockIn);
  const endDate = clockOut ? new Date(clockOut) : new Date();

  const startHour = startDate.getHours() + startDate.getMinutes() / 60;
  const endHour = endDate.getHours() + endDate.getMinutes() / 60;

  const left = Math.max(0, ((startHour - HOUR_START) / TOTAL_HOURS) * 100);
  const right = Math.min(100, ((endHour - HOUR_START) / TOTAL_HOURS) * 100);
  const width = Math.max(0, right - left);

  return { left: `${left}%`, width: `${width}%` };
}

export default function TeamTimeline({ records, absentMembers = [] }: { records: TeamRecord[]; absentMembers?: AbsentMember[] }) {
  const t = useT();
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => HOUR_START + i);

  function getDuration(clockIn: string, clockOut: string | null) {
    const end = clockOut ? new Date(clockOut).getTime() : Date.now();
    const diff = end - new Date(clockIn).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}${t("common.hours")} ${m}${t("common.minutes")}`;
  }

  const [open, setOpen] = useState(true);
  const workingCount = records.filter((r) => !r.clockOut).length;

  return (
    <div className="rounded-xl bg-white">
      <button
        type="button"
        className={`flex w-full items-center justify-between px-6 py-4 ${open ? "border-b border-gray-100" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-medium text-gray-900">{t("dashboard.teamStatus")}</h2>
          {!open && workingCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-600">{workingCount}{t("dashboard.working")}</span>
            </span>
          )}
          {absentMembers.length > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">{t("dashboard.untagged")} {absentMembers.length}</span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!open ? null : records.length === 0 && absentMembers.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-gray-400">{t("dashboard.noTeamToday")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-[800px]">
            <div className="w-48 shrink-0" />
            <div className="relative flex flex-1">
              {hours.map((h) => (
                <div
                  key={h}
                  className="flex-1 border-l border-gray-100 py-2 text-center text-xs text-gray-400"
                >
                  {h}
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {records.map((record, i) => {
              const isWorking = !record.clockOut;
              const barStyle = getBarStyle(record.clockIn, record.clockOut);

              return (
                <div key={i} className="flex min-w-[800px] items-center">
                  <div className="flex w-48 shrink-0 items-center gap-3 px-6 py-4">
                    <Avatar url={record.avatarUrl} name={record.name} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{record.name}</p>
                      <p className="text-xs text-blue-500">{getDuration(record.clockIn, record.clockOut)}</p>
                    </div>
                  </div>

                  <div className="relative flex-1 py-4 pr-4">
                    <div className="relative h-10 rounded-lg bg-gray-50">
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="absolute top-0 h-full border-l border-gray-100"
                          style={{ left: `${((h - HOUR_START) / TOTAL_HOURS) * 100}%` }}
                        />
                      ))}
                      <div
                        className={`absolute top-1 h-8 rounded-md px-2.5 py-1 ${
                          isWorking ? "bg-emerald-100" : "bg-blue-50"
                        }`}
                        style={barStyle}
                      >
                        <div className="flex h-full items-center gap-1.5 overflow-hidden">
                          {isWorking && (
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          )}
                          <span className={`truncate text-xs font-medium ${isWorking ? "text-emerald-700" : "text-blue-600"}`}>
                            {formatTime(record.clockIn)}
                            {record.clockOut ? ` - ${formatTime(record.clockOut)}` : " ~"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 미태그(오늘 출근 안 찍은 활성 멤버) */}
            {absentMembers.map((m, i) => (
              <div key={`absent-${i}`} className="flex min-w-[800px] items-center">
                <div className="flex w-48 shrink-0 items-center gap-3 px-6 py-4">
                  <div className="opacity-60"><Avatar url={m.avatarUrl} name={m.name} size={32} /></div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-500">{m.name}</p>
                    <p className="text-xs text-gray-400">{t("dashboard.untagged")}</p>
                  </div>
                </div>
                <div className="relative flex-1 py-4 pr-4">
                  <div className="flex h-10 items-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">{t("dashboard.untagged")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
