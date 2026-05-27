"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LeaveSettings from "../../leaves/leave-settings";

type Settings = {
  auto_grant: boolean;
  default_annual_days: number;
  grant_basis: string;
} | null;

const GRANT_BASIS_LABEL: Record<string, string> = {
  join_date: "입사일 기준",
  fiscal_year: "회계연도 기준",
};

export default function LeaveSettingsView({
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
        <p className="text-sm text-gray-400">아직 연차 제도가 설정되지 않았습니다</p>
      </div>
    );
  }

  if (editing || (!current && isManager)) {
    return <LeaveSettings current={current} onSaved={handleSaved} />;
  }

  return (
    <div className="rounded-xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">연차 제도</h2>
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
            <span className="text-sm text-gray-500">자동 부여</span>
            <span className="text-sm text-gray-900">{current.auto_grant ? "사용" : "미사용"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">기본 연차</span>
            <span className="text-sm text-gray-900">{current.default_annual_days}일</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">부여 기준</span>
            <span className="text-sm text-gray-900">{GRANT_BASIS_LABEL[current.grant_basis]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
