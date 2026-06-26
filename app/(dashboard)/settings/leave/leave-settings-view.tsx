"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LeaveSettings from "../../leaves/leave-settings";
import { useT } from "@/lib/i18n";

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

export default function LeaveSettingsView({
  current,
  isManager,
}: {
  current: Settings;
  isManager: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  const enabled = t("leaveSettings.enabled");
  const disabled = t("leaveSettings.disabled");
  const days = t("common.days");

  function handleSaved() {
    setEditing(false);
    router.refresh();
  }

  if (!current && !isManager) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-white">
        <p className="text-sm text-gray-600">{t("leaveSettings.noSettings")}</p>
      </div>
    );
  }

  if (editing || (!current && isManager)) {
    return <LeaveSettings current={current} onSaved={handleSaved} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">{t("leaveSettings.grantTitle")}</h2>
          {isManager && (
            <button onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:text-blue-600">
              {t("common.edit")}
            </button>
          )}
        </div>
        {current && (
          <div className="flex flex-col gap-3">
            <Row label={t("leaveSettings.autoGrant")} value={current.auto_grant ? enabled : disabled} />
            <Row label={t("leaveSettings.defaultAnnual")} value={`${current.default_annual_days}${days}`} />
            <Row label={t("leaveSettings.grantBasis")} value={current.grant_basis === "join_date" ? t("leaveSettings.joinDateBasis") : t("leaveSettings.fiscalYearBasis")} />
            <Row label={t("leaveSettings.firstYearMonthly")} value={current.first_year_monthly ? enabled : disabled} />
            <Row label={t("leaveSettings.longevityBonus")} value={current.longevity_bonus ? `${enabled} (${t("leaveSettings.maxDays")} ${current.max_annual_days}${days})` : disabled} />
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-900">{t("leaveSettings.manageTitle")}</h2>
        {current && (
          <div className="flex flex-col gap-3">
            <Row
              label={t("leaveSettings.carryOver")}
              value={current.carry_over
                ? current.carry_over_max_days > 0 ? `${t("leaveSettings.maxDays")} ${current.carry_over_max_days}${days}` : t("leaveSettings.fullCarryOver")
                : disabled}
            />
            <Row label={t("leaveSettings.annualPromotion")} value={current.annual_promotion ? enabled : disabled} />
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-900">{t("leaveSettings.specialTitle")}</h2>
        {current && (
          <div className="flex flex-col gap-3">
            <Row label={t("leaveSettings.paidSickLeave")} value={current.sick_leave_days > 0 ? `${current.sick_leave_days}${days}` : disabled} />
            <Row label={t("leaveSettings.condolenceLeave")} value={current.condolence_leave ? enabled : disabled} />
            <Row label={t("leaveSettings.maternityLeave")} value={current.maternity_leave ? `90${days}` : disabled} />
            <Row label={t("leaveSettings.paternityLeave")} value={current.paternity_leave ? `10${days}` : disabled} />
            <Row label={t("leaveSettings.familyCareDays")} value={`${current.family_care_days}${days}`} />
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
