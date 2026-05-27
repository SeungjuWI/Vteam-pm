"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LeaveSettings from "../../leaves/leave-settings";

type Settings = {
  auto_grant: boolean;
  default_annual_days: number;
  grant_basis: string;
  first_year_monthly: boolean;
  longevity_bonus: boolean;
  max_annual_days: number;
  carry_over: boolean;
  carry_over_max_days: number;
  annual_promotion: boolean;
  sick_leave_days: number;
  condolence_leave: boolean;
  maternity_leave: boolean;
  paternity_leave: boolean;
  family_care_days: number;
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
    <div className="flex flex-col gap-4">
      {/* 연차 부여 */}
      <div className="rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">연차 부여</h2>
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
            <Row label="자동 부여" value={current.auto_grant ? "사용" : "미사용"} />
            <Row label="기본 연차" value={`${current.default_annual_days}일`} />
            <Row label="부여 기준" value={GRANT_BASIS_LABEL[current.grant_basis]} />
            <Row label="1년 미만 월차" value={current.first_year_monthly ? "사용" : "미사용"} />
            <Row label="근속 가산" value={current.longevity_bonus ? `사용 (최대 ${current.max_annual_days}일)` : "미사용"} />
          </div>
        )}
      </div>

      {/* 연차 관리 */}
      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-900">연차 관리</h2>
        {current && (
          <div className="flex flex-col gap-3">
            <Row
              label="연차 이월"
              value={current.carry_over
                ? current.carry_over_max_days > 0 ? `최대 ${current.carry_over_max_days}일` : "전체 이월"
                : "미사용"}
            />
            <Row label="연차촉진제" value={current.annual_promotion ? "사용" : "미사용"} />
          </div>
        )}
      </div>

      {/* 특별휴가 */}
      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-900">특별휴가</h2>
        {current && (
          <div className="flex flex-col gap-3">
            <Row label="유급 병가" value={current.sick_leave_days > 0 ? `${current.sick_leave_days}일` : "미사용"} />
            <Row label="경조사 휴가" value={current.condolence_leave ? "사용" : "미사용"} />
            <Row label="출산 휴가" value={current.maternity_leave ? "90일" : "미사용"} />
            <Row label="배우자 출산 휴가" value={current.paternity_leave ? "10일" : "미사용"} />
            <Row label="가족돌봄 휴가" value={`${current.family_care_days}일`} />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}
