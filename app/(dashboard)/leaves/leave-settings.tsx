"use client";

import { useState } from "react";
import { saveLeaveSettings } from "./actions";
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

type Props = {
  current: Settings;
  onSaved?: () => void;
};

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-blue-500" : "bg-gray-300"}`}
    >
      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${value ? "translate-x-5.5" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function LeaveSettings({ current, onSaved }: Props) {
  const t = useT();
  const [autoGrant, setAutoGrant] = useState(current?.auto_grant ?? true);
  const [defaultDays, setDefaultDays] = useState(current?.default_annual_days ?? 15);
  const [grantBasis, setGrantBasis] = useState(current?.grant_basis ?? "join_date");
  const [firstYearMonthly, setFirstYearMonthly] = useState(current?.first_year_monthly ?? true);
  const [longevityBonus, setLongevityBonus] = useState(current?.longevity_bonus ?? true);
  const [maxAnnualDays, setMaxAnnualDays] = useState(current?.max_annual_days ?? 25);
  const [carryOver, setCarryOver] = useState(current?.carry_over ?? false);
  const [carryOverMaxDays, setCarryOverMaxDays] = useState(current?.carry_over_max_days ?? 0);
  const [annualPromotion, setAnnualPromotion] = useState(current?.annual_promotion ?? false);
  const [sickLeaveDays, setSickLeaveDays] = useState(current?.sick_leave_days ?? 0);
  const [condolenceLeave, setCondolenceLeave] = useState(current?.condolence_leave ?? true);
  const [maternityLeave, setMaternityLeave] = useState(current?.maternity_leave ?? true);
  const [paternityLeave, setPaternityLeave] = useState(current?.paternity_leave ?? true);
  const [familyCareDays, setFamilyCareDays] = useState(current?.family_care_days ?? 10);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await saveLeaveSettings(formData);
    if (result?.success) {
      onSaved?.();
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={handleSubmit} className="flex flex-col gap-4">
        {/* Hidden fields */}
        <input type="hidden" name="autoGrant" value={String(autoGrant)} />
        <input type="hidden" name="grantBasis" value={grantBasis} />
        <input type="hidden" name="firstYearMonthly" value={String(firstYearMonthly)} />
        <input type="hidden" name="longevityBonus" value={String(longevityBonus)} />
        <input type="hidden" name="carryOver" value={String(carryOver)} />
        <input type="hidden" name="annualPromotion" value={String(annualPromotion)} />
        <input type="hidden" name="condolenceLeave" value={String(condolenceLeave)} />
        <input type="hidden" name="maternityLeave" value={String(maternityLeave)} />
        <input type="hidden" name="paternityLeave" value={String(paternityLeave)} />

        {/* 연차 부여 */}
        <div className="rounded-xl bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-gray-900">{t("leaveSettings.grantTitle")}</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">{t("leaveSettings.autoGrant")}</p>
                <p className="text-xs text-gray-500">{t("leaveSettings.autoGrantDesc")}</p>
              </div>
              <Toggle value={autoGrant} onChange={setAutoGrant} />
            </div>

            {autoGrant && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("leaveSettings.defaultDays")}</label>
                  <input
                    type="number"
                    name="defaultDays"
                    value={defaultDays}
                    onChange={(e) => setDefaultDays(Number(e.target.value))}
                    min={0}
                    max={50}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-600">{t("leaveSettings.defaultDaysDesc")}</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("leaveSettings.grantBasis")}</label>
                  <div className="flex gap-2">
                    {[
                      { value: "join_date", label: t("leaveSettings.joinDateBasis") },
                      { value: "fiscal_year", label: t("leaveSettings.fiscalYearBasis") },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGrantBasis(opt.value)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          grantBasis === opt.value ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    {grantBasis === "join_date"
                      ? t("leaveSettings.joinDateDesc")
                      : t("leaveSettings.fiscalYearDesc")}
                  </p>
                </div>

                <div className="h-px bg-gray-100" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-900">{t("leaveSettings.firstYearMonthly")}</p>
                    <p className="text-xs text-gray-500">{t("leaveSettings.firstYearMonthlyDesc")}</p>
                  </div>
                  <Toggle value={firstYearMonthly} onChange={setFirstYearMonthly} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-900">{t("leaveSettings.longevityBonus")}</p>
                    <p className="text-xs text-gray-500">{t("leaveSettings.longevityBonusDesc")}</p>
                  </div>
                  <Toggle value={longevityBonus} onChange={setLongevityBonus} />
                </div>

                {longevityBonus && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("leaveSettings.maxAnnualDays")}</label>
                    <input
                      type="number"
                      name="maxAnnualDays"
                      value={maxAnnualDays}
                      onChange={(e) => setMaxAnnualDays(Number(e.target.value))}
                      min={15}
                      max={50}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-600">{t("leaveSettings.maxAnnualDaysDesc")}</p>
                  </div>
                )}
              </>
            )}
            {!autoGrant && <input type="hidden" name="defaultDays" value={defaultDays} />}
            {!longevityBonus && <input type="hidden" name="maxAnnualDays" value={maxAnnualDays} />}
          </div>
        </div>

        {/* 연차 관리 */}
        <div className="rounded-xl bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-gray-900">{t("leaveSettings.manageTitle")}</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">{t("leaveSettings.carryOver")}</p>
                <p className="text-xs text-gray-500">{t("leaveSettings.carryOverDesc")}</p>
              </div>
              <Toggle value={carryOver} onChange={setCarryOver} />
            </div>

            {carryOver && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("leaveSettings.carryOverMaxDays")}</label>
                <input
                  type="number"
                  name="carryOverMaxDays"
                  value={carryOverMaxDays}
                  onChange={(e) => setCarryOverMaxDays(Number(e.target.value))}
                  min={0}
                  max={50}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-600">{t("leaveSettings.carryOverMaxDaysDesc")}</p>
              </div>
            )}
            {!carryOver && <input type="hidden" name="carryOverMaxDays" value={carryOverMaxDays} />}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">{t("leaveSettings.annualPromotion")}</p>
                <p className="text-xs text-gray-500">{t("leaveSettings.annualPromotionDesc")}</p>
              </div>
              <Toggle value={annualPromotion} onChange={setAnnualPromotion} />
            </div>
          </div>
        </div>

        {/* 특별휴가 */}
        <div className="rounded-xl bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-gray-900">{t("leaveSettings.specialTitle")}</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("leaveSettings.sickLeaveDays")}</label>
              <input
                type="number"
                name="sickLeaveDays"
                value={sickLeaveDays}
                onChange={(e) => setSickLeaveDays(Number(e.target.value))}
                min={0}
                max={30}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-600">{t("leaveSettings.sickLeaveDaysDesc")}</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">{t("leaveSettings.condolenceLeave")}</p>
                <p className="text-xs text-gray-500">{t("leaveSettings.condolenceLeaveDesc")}</p>
              </div>
              <Toggle value={condolenceLeave} onChange={setCondolenceLeave} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">{t("leaveSettings.maternityLeave")}</p>
                <p className="text-xs text-gray-500">{t("leaveSettings.maternityLeaveDesc")}</p>
              </div>
              <Toggle value={maternityLeave} onChange={setMaternityLeave} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">{t("leaveSettings.paternityLeave")}</p>
                <p className="text-xs text-gray-500">{t("leaveSettings.paternityLeaveDesc")}</p>
              </div>
              <Toggle value={paternityLeave} onChange={setPaternityLeave} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("leaveSettings.familyCareDays")}</label>
              <input
                type="number"
                name="familyCareDays"
                value={familyCareDays}
                onChange={(e) => setFamilyCareDays(Number(e.target.value))}
                min={0}
                max={30}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-600">{t("leaveSettings.familyCareDaysDesc")}</p>
            </div>
          </div>
        </div>

        {/* 저장/취소 */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? t("common.saving") : t("common.save")}
          </button>
          {onSaved && (
            <button
              type="button"
              onClick={onSaved}
              className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              {t("common.cancel")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
