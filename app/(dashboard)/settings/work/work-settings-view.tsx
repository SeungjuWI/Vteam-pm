"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WorkSettingsForm from "./work-settings-form";

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

const WORK_TYPE_LABEL: Record<string, string> = {
  fixed: "고정 출퇴근",
  flexible: "시차 출퇴근",
  free: "자율 출퇴근",
};

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
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  function handleSaved() {
    setEditing(false);
    router.refresh();
  }

  if (!current && !isManager) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-white">
        <p className="text-sm text-gray-400">아직 근무 규정이 설정되지 않았습니다</p>
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
          <h2 className="text-sm font-medium text-gray-900">근무 규정</h2>
          {isManager && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              수정
            </button>
          )}
        </div>
        {current && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">근무 유형</span>
              <span className="text-sm text-gray-900">{WORK_TYPE_LABEL[current.work_type]}</span>
            </div>
            {current.work_type === "fixed" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">출퇴근 시간</span>
                <span className="text-sm text-gray-900">
                  {current.fixed_start?.slice(0, 5)} ~ {current.fixed_end?.slice(0, 5)}
                </span>
              </div>
            )}
            {current.work_type === "flexible" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">출근 가능 시간</span>
                <span className="text-sm text-gray-900">
                  {current.flexible_start?.slice(0, 5)} ~ {current.flexible_end?.slice(0, 5)}
                </span>
              </div>
            )}
            {current.work_type === "free" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">코어타임</span>
                <span className="text-sm text-gray-900">
                  {current.core_time_enabled
                    ? `${current.core_time_start?.slice(0, 5)} ~ ${current.core_time_end?.slice(0, 5)}`
                    : "없음"}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">필수 근무시간</span>
              <span className="text-sm text-gray-900">{current.required_hours}시간</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">점심시간</span>
              <span className="text-sm text-gray-900">
                {current.lunch_start?.slice(0, 5)} ~ {lunchEndTime(current.lunch_start?.slice(0, 5) || "12:00", current.lunch_duration)} ({current.lunch_duration}분)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
