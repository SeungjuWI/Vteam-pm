"use client";

import { useRef, useState } from "react";
import { requestLeave } from "./actions";

const TYPES = [
  { value: "annual", label: "연차" },
  { value: "half_am", label: "오전 반차" },
  { value: "half_pm", label: "오후 반차" },
  { value: "sick", label: "병가" },
  { value: "other", label: "기타" },
];

// 5분 단위 시간 옵션 생성
function generateTimeOptions() {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
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
      <h2 className="mb-4 text-sm font-medium text-gray-900">연차 신청</h2>
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
        {/* 유형 */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">유형</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
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
          <input type="hidden" name="type" value={type} />
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
            <div className="relative">
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
            <div className="relative">
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
        </div>

        {/* 사유 */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">사유 (선택)</label>
          <input
            type="text"
            name="reason"
            placeholder="사유를 입력하세요"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-blue-500">연차 신청이 완료되었습니다</p>}

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
