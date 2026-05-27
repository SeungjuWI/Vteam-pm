"use client";

import { useState } from "react";
import { saveLeaveSettings } from "./actions";

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
          <h2 className="mb-4 text-sm font-medium text-gray-900">연차 부여</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">자동 부여</p>
                <p className="text-xs text-gray-500">멤버에게 연차를 자동으로 부여합니다</p>
              </div>
              <Toggle value={autoGrant} onChange={setAutoGrant} />
            </div>

            {autoGrant && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">기본 연차 일수</label>
                  <input
                    type="number"
                    name="defaultDays"
                    value={defaultDays}
                    onChange={(e) => setDefaultDays(Number(e.target.value))}
                    min={0}
                    max={50}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-400">근로기준법 기준 1년 이상 근로자 15일</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">부여 기준</label>
                  <div className="flex gap-2">
                    {[
                      { value: "join_date", label: "입사일 기준" },
                      { value: "fiscal_year", label: "회계연도 기준" },
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
                  <p className="mt-1 text-xs text-gray-400">
                    {grantBasis === "join_date"
                      ? "입사일 기준으로 매년 연차가 발생합니다"
                      : "매년 1월 1일 기준으로 동일하게 부여됩니다"}
                  </p>
                </div>

                <div className="h-px bg-gray-100" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-900">1년 미만 월차</p>
                    <p className="text-xs text-gray-500">입사 1년 미만 근로자에게 매월 1일씩 부여 (최대 11일)</p>
                  </div>
                  <Toggle value={firstYearMonthly} onChange={setFirstYearMonthly} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-900">근속 가산</p>
                    <p className="text-xs text-gray-500">3년 이상 근무 시 2년마다 1일 추가</p>
                  </div>
                  <Toggle value={longevityBonus} onChange={setLongevityBonus} />
                </div>

                {longevityBonus && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">최대 연차 일수</label>
                    <input
                      type="number"
                      name="maxAnnualDays"
                      value={maxAnnualDays}
                      onChange={(e) => setMaxAnnualDays(Number(e.target.value))}
                      min={15}
                      max={50}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-400">근로기준법 기준 최대 25일</p>
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
          <h2 className="mb-4 text-sm font-medium text-gray-900">연차 관리</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">연차 이월</p>
                <p className="text-xs text-gray-500">미사용 연차를 다음 해로 이월합니다</p>
              </div>
              <Toggle value={carryOver} onChange={setCarryOver} />
            </div>

            {carryOver && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">이월 최대 일수</label>
                <input
                  type="number"
                  name="carryOverMaxDays"
                  value={carryOverMaxDays}
                  onChange={(e) => setCarryOverMaxDays(Number(e.target.value))}
                  min={0}
                  max={50}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">0으로 설정 시 전체 이월</p>
              </div>
            )}
            {!carryOver && <input type="hidden" name="carryOverMaxDays" value={carryOverMaxDays} />}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">연차촉진제</p>
                <p className="text-xs text-gray-500">사용 촉진 통보를 통해 미사용 연차수당 부담을 면제합니다</p>
              </div>
              <Toggle value={annualPromotion} onChange={setAnnualPromotion} />
            </div>
          </div>
        </div>

        {/* 특별휴가 */}
        <div className="rounded-xl bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-gray-900">특별휴가</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">유급 병가 일수</label>
              <input
                type="number"
                name="sickLeaveDays"
                value={sickLeaveDays}
                onChange={(e) => setSickLeaveDays(Number(e.target.value))}
                min={0}
                max={30}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-400">근로기준법상 무급이나, 회사에서 유급 병가를 부여할 수 있습니다</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">경조사 휴가</p>
                <p className="text-xs text-gray-500">결혼, 사망, 출산 등 경조사 유급휴가</p>
              </div>
              <Toggle value={condolenceLeave} onChange={setCondolenceLeave} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">출산 휴가</p>
                <p className="text-xs text-gray-500">출산 전후 90일 (근로기준법 의무)</p>
              </div>
              <Toggle value={maternityLeave} onChange={setMaternityLeave} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">배우자 출산 휴가</p>
                <p className="text-xs text-gray-500">배우자 출산 시 10일 유급 (남녀고용평등법)</p>
              </div>
              <Toggle value={paternityLeave} onChange={setPaternityLeave} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">가족돌봄 휴가 일수</label>
              <input
                type="number"
                name="familyCareDays"
                value={familyCareDays}
                onChange={(e) => setFamilyCareDays(Number(e.target.value))}
                min={0}
                max={30}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-400">남녀고용평등법 기준 연 10일 (연차 차감)</p>
            </div>
          </div>
        </div>

        {/* 저장/취소 */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "저장 중..." : "저장"}
          </button>
          {onSaved && (
            <button
              type="button"
              onClick={onSaved}
              className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              취소
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
