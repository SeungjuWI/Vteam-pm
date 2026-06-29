"use client";

import { useRef, useState } from "react";
import { requestLeave } from "./actions";
import { useT } from "@/lib/i18n";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";

const LEAVE_CATEGORIES_DATA = [
  {
    labelKey: "leaveCategory.annual" as const,
    types: [
      { value: "annual", labelKey: "leaveType.annual" as const, deductsBalance: true },
      { value: "half_am", labelKey: "leaveType.half_am" as const, deductsBalance: true },
      { value: "half_pm", labelKey: "leaveType.half_pm" as const, deductsBalance: true },
    ],
  },
  {
    labelKey: "leaveCategory.statutory" as const,
    types: [
      { value: "sick", labelKey: "leaveType.sick" as const, deductsBalance: false },
      { value: "condolence", labelKey: "leaveType.condolence" as const, deductsBalance: false },
      { value: "maternity", labelKey: "leaveType.maternity" as const, deductsBalance: false },
      { value: "paternity", labelKey: "leaveType.paternity" as const, deductsBalance: false },
      { value: "family_care", labelKey: "leaveType.family_care" as const, deductsBalance: true },
      { value: "public_duty", labelKey: "leaveType.public_duty" as const, deductsBalance: false },
      { value: "menstrual", labelKey: "leaveType.menstrual" as const, deductsBalance: false },
    ],
  },
  {
    labelKey: "leaveCategory.other" as const,
    types: [
      { value: "compensatory", labelKey: "leaveType.compensatory" as const, deductsBalance: false },
      { value: "other", labelKey: "leaveType.other" as const, deductsBalance: false },
    ],
  },
];

const ALL_TYPES = LEAVE_CATEGORIES_DATA.flatMap((c) => c.types as { value: string; labelKey: string; deductsBalance: boolean }[]);

function generateTimeOptions() {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

export default function LeaveRequestForm() {
  const t = useT();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("annual");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const formRef = useRef<HTMLFormElement>(null);

  const selectedType = ALL_TYPES.find((tp) => tp.value === type);

  function handleTypeChange(newType: string) {
    setType(newType);
    if (newType === "half_am") {
      setStartTime("09:00");
      setEndTime("13:00");
    } else if (newType === "half_pm") {
      setStartTime("14:00");
      setEndTime("18:00");
    } else {
      setStartTime("09:00");
      setEndTime("18:00");
    }
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    setSuccess(false);
    const result = await requestLeave(formData);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(true);
      formRef.current?.reset();
      setType("annual");
      setStartTime("09:00");
      setEndTime("18:00");
      setStartDate(today);
      setEndDate(today);
      setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl bg-white p-6">
      <h2 className="mb-4 text-sm font-medium text-gray-900">{t("leaves.request")}</h2>
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
        {/* 유형 */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("leaves.type")}</label>
          {LEAVE_CATEGORIES_DATA.map((cat) => (
            <div key={cat.labelKey} className="mb-2">
              <p className="mb-1 text-[11px] text-gray-600">{t(cat.labelKey)}</p>
              <div className="flex flex-wrap gap-1.5">
                {cat.types.map((tp) => (
                  <button
                    key={tp.value}
                    type="button"
                    onClick={() => handleTypeChange(tp.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      type === tp.value
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {t(tp.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <input type="hidden" name="type" value={type} />
          {selectedType && !selectedType.deductsBalance && (
            <p className="mt-1 text-[11px] text-green-600">{t("leaves.noDeduction")}</p>
          )}
        </div>

        {/* 날짜 + 시간 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("leaves.startDate")}</label>
            <input type="hidden" name="startDate" value={startDate} />
            <DatePicker value={startDate} onChange={(v) => setStartDate(v)} className="w-full" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("leaves.startTime")}</label>
            <input type="hidden" name="startTime" value={startTime} />
            <Select
              value={startTime}
              onChange={(v) => setStartTime(v)}
              options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("leaves.endDate")}</label>
            <input type="hidden" name="endDate" value={endDate} />
            <DatePicker value={endDate} onChange={(v) => setEndDate(v)} className="w-full" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("leaves.endTime")}</label>
            <input type="hidden" name="endTime" value={endTime} />
            <Select
              value={endTime}
              onChange={(v) => setEndTime(v)}
              options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
              className="w-full"
            />
          </div>
        </div>

        {/* 사유 */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            {t("leaves.reason")} {type === "condolence" || type === "other" ? t("common.required") : t("common.optional")}
          </label>
          <input
            type="text"
            name="reason"
            placeholder={type === "condolence" ? t("leaves.condolencePlaceholder") : t("leaves.reasonPlaceholder")}
            required={type === "condolence" || type === "other"}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-blue-500">{t("leaves.success")}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? t("leaves.requesting") : t("leaves.submit")}
        </button>
      </form>
    </div>
  );
}
