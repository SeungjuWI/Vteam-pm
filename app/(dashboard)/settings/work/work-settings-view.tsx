"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WorkSettingsForm from "./work-settings-form";
import { useT } from "@/lib/i18n";

type Settings = {
  work_type: string;
  fixed_start: string | null;
  fixed_end: string | null;
  flexible_start: string | null;
  flexible_end: string | null;
  required_hours: number;
  lunch_start: string | null;
  lunch_duration: number;
  core_time_enabled: boolean;
  core_time_start: string | null;
  core_time_end: string | null;
} | null;

function lunchEndTime(start: string, duration: number) {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + duration;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function WorkSettingsView({
  current,
  isManager,
}: {
  current: Settings;
  isManager: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  const WORK_TYPE_LABEL: Record<string, string> = {
    fixed: t("work.fixed"),
    flexible: t("work.flexible"),
    free: t("work.free"),
  };

  function handleSaved() {
    setEditing(false);
    router.refresh();
  }

  if (!current && !isManager) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-white">
        <p className="text-sm text-gray-400">{t("work.noSettings")}</p>
      </div>
    );
  }

  if (editing || (!current && isManager)) {
    return <WorkSettingsForm current={current} onSaved={handleSaved} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">{t("work.title")}</h2>
          {isManager && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              {t("common.edit")}
            </button>
          )}
        </div>
        {current && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{t("work.type")}</span>
              <span className="text-sm text-gray-900">{WORK_TYPE_LABEL[current.work_type]}</span>
            </div>
            {current.work_type === "fixed" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t("work.commute")}</span>
                <span className="text-sm text-gray-900">
                  {current.fixed_start?.slice(0, 5)} ~ {current.fixed_end?.slice(0, 5)}
                </span>
              </div>
            )}
            {current.work_type === "flexible" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t("work.availableTime")}</span>
                <span className="text-sm text-gray-900">
                  {current.flexible_start?.slice(0, 5)} ~ {current.flexible_end?.slice(0, 5)}
                </span>
              </div>
            )}
            {current.work_type === "free" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t("work.coreTime")}</span>
                <span className="text-sm text-gray-900">
                  {current.core_time_enabled
                    ? `${current.core_time_start?.slice(0, 5)} ~ ${current.core_time_end?.slice(0, 5)}`
                    : t("work.none")}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{t("work.requiredHours")}</span>
              <span className="text-sm text-gray-900">{current.required_hours}{t("common.hours")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{t("work.lunchTime")}</span>
              <span className="text-sm text-gray-900">
                {current.lunch_start?.slice(0, 5)} ~ {lunchEndTime(current.lunch_start?.slice(0, 5) || "12:00", current.lunch_duration)} ({current.lunch_duration}{t("common.minutes")})
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
