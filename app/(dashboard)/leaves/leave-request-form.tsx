"use client";

import { useRef, useState } from "react";
import { requestLeave } from "./actions";

const LEAVE_CATEGORIES = [
  {
    label: "연차",
    types: [
      { value: "annual", label: "연차", deductsBalance: true },
      { value: "half_am", label: "오전 반차", deductsBalance: true },
      { value: "half_pm", label: "오후 반차", deductsBalance: true },
    ],
  },
  {
    label: "법정휴가",
    types: [
      { value: "sick", label: "병가", deductsBalance: false },
      { value: "condolence", label: "경조사", deductsBalance: false },
      { value: "maternity", label: "출산", deductsBalance: false },
      { value: "paternity", label: "배우자출산", deductsBalance: false },
      { value: "family_care", label: "가족돌봄", deductsBalance: true },
      { value: "public_duty", label: "공가", deductsBalance: false },
      { value: "menstrual", label: "생리", deductsBalance: false },
    ],
  },
  {
    label: "기타",
    types: [
      { value: "compensatory", label: "대체휴가", deductsBalance: false },
      { value: "other", label: "기타", deductsBalance: false },
    ],
  },
];

const ALL_TYPES = LEAVE_CATEGORIES.flatMap((c) => c.types);

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("annual");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const formRef = useRef<HTMLFormElement>(null);

  const selectedType = ALL_TYPES.find((t) => t.value === type);

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
      setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="rounded-xl bg-white p-6">
      <h2 className="mb-4 text-sm font-medium text-gray-900">휴가 신청</h2>
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
        {/* 유형 */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">유형</label>
          {LEAVE_CATEGORIES.map((cat) => (
            <div key={cat.label} className="mb-2">
              <p className="mb-1 text-[11px] text-gray-400">{cat.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {cat.types.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => handleTypeChange(t.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      type === t.value
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <input type="hidden" name="type" value={type} />
          {selectedType && !selectedType.deductsBalance && (
            <p className="mt-1 text-[11px] text-green-600">이 휴가는 연차에서 차감되지 않습니다</p>
          )}
        </div>

        {/* 날짜 + 시간 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">시작일</label>
            <input
              type="date"
              name="startDate"
              defaultValue={today}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">시작 시간</label>
            <select
              name="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">종료일</label>
            <input
              type="date"
              name="endDate"
              defaultValue={today}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">종료 시간</label>
            <select
              name="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 사유 */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            사유 {type === "condolence" || type === "other" ? "(필수)" : "(선택)"}
          </label>
          <input
            type="text"
            name="reason"
            placeholder={type === "condolence" ? "예: 부모 회갑" : "사유를 입력하세요"}
            required={type === "condolence" || type === "other"}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-blue-500">휴가 신청이 완료되었습니다</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "신청 중..." : "신청하기"}
        </button>
      </form>
    </div>
  );
}
