"use client";

import { useState } from "react";
import { saveWorkSettings } from "./actions";

type Props = {
  current: {
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
  onSaved?: () => void;
};

const WORK_TYPES = [
  { value: "fixed", label: "고정 출퇴근", desc: "정해진 시간에 출퇴근" },
  { value: "flexible", label: "시차 출퇴근", desc: "허용 시간 내 자율 출근" },
  { value: "free", label: "자율 출퇴근", desc: "출퇴근 시간 제한 없음" },
];

const LUNCH_OPTIONS = [
  { value: 30, label: "30분" },
  { value: 60, label: "1시간" },
  { value: 90, label: "1시간 30분" },
];

function timeOptions() {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      opts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return opts;
}

const TIME_OPTS = timeOptions();

export default function WorkSettingsForm({ current, onSaved }: Props) {
  const [workType, setWorkType] = useState(current?.work_type ?? "flexible");
  const [fixedStart, setFixedStart] = useState(current?.fixed_start?.slice(0, 5) ?? "09:00");
  const [fixedEnd, setFixedEnd] = useState(current?.fixed_end?.slice(0, 5) ?? "18:00");
  const [flexStart, setFlexStart] = useState(current?.flexible_start?.slice(0, 5) ?? "07:00");
  const [flexEnd, setFlexEnd] = useState(current?.flexible_end?.slice(0, 5) ?? "11:00");
  const [requiredHours, setRequiredHours] = useState(current?.required_hours ?? 8);
  const [lunchStart, setLunchStart] = useState(current?.lunch_start?.slice(0, 5) ?? "12:00");
  const [lunchDuration, setLunchDuration] = useState(current?.lunch_duration ?? 60);
  const [coreEnabled, setCoreEnabled] = useState(current?.core_time_enabled ?? false);
  const [coreStart, setCoreStart] = useState(current?.core_time_start?.slice(0, 5) ?? "10:00");
  const [coreEnd, setCoreEnd] = useState(current?.core_time_end?.slice(0, 5) ?? "16:00");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setSuccess(false);
    const result = await saveWorkSettings(formData);
    if (result?.success) {
      onSaved?.();
    }
    setLoading(false);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="workType" value={workType} />
      <input type="hidden" name="fixedStart" value={fixedStart} />
      <input type="hidden" name="fixedEnd" value={fixedEnd} />
      <input type="hidden" name="flexibleStart" value={flexStart} />
      <input type="hidden" name="flexibleEnd" value={flexEnd} />
      <input type="hidden" name="requiredHours" value={requiredHours} />
      <input type="hidden" name="lunchStart" value={lunchStart} />
      <input type="hidden" name="lunchDuration" value={lunchDuration} />
      <input type="hidden" name="coreEnabled" value={String(coreEnabled)} />
      <input type="hidden" name="coreStart" value={coreStart} />
      <input type="hidden" name="coreEnd" value={coreEnd} />

      {/* 근무 유형 */}
      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-900">근무 유형</h2>
        <div className="flex flex-col gap-2">
          {WORK_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setWorkType(t.value)}
              className={`flex flex-col rounded-xl border p-4 text-left transition-colors ${
                workType === t.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className={`text-sm font-medium ${workType === t.value ? "text-blue-600" : "text-gray-900"}`}>
                {t.label}
              </span>
              <span className="mt-0.5 text-xs text-gray-500">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 출퇴근 시간 */}
      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-900">출퇴근 시간</h2>

        {workType === "fixed" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">출근 시간</label>
              <select
                value={fixedStart}
                onChange={(e) => setFixedStart(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                {TIME_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">퇴근 시간</label>
              <select
                value={fixedEnd}
                onChange={(e) => setFixedEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                {TIME_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}

        {workType === "flexible" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">출근 가능 시작</label>
                <select
                  value={flexStart}
                  onChange={(e) => setFlexStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  {TIME_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">출근 가능 마감</label>
                <select
                  value={flexEnd}
                  onChange={(e) => setFlexEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  {TIME_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {flexStart} ~ {flexEnd} 사이에 출근하면 됩니다
            </p>
          </div>
        )}

        {workType === "free" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">출퇴근 시간 제한이 없습니다</p>

            {/* 코어타임 */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-900">코어타임</p>
                  <p className="text-xs text-gray-500">반드시 근무해야 하는 시간대</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCoreEnabled(!coreEnabled)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${coreEnabled ? "bg-blue-500" : "bg-gray-300"}`}
                >
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${coreEnabled ? "translate-x-5.5" : "translate-x-0.5"}`} />
                </button>
              </div>
              {coreEnabled && (
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">시작</label>
                    <select
                      value={coreStart}
                      onChange={(e) => setCoreStart(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    >
                      {TIME_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">종료</label>
                    <select
                      value={coreEnd}
                      onChange={(e) => setCoreEnd(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    >
                      {TIME_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 필수 근무시간 */}
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-gray-600">일일 필수 근무시간</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={requiredHours}
              onChange={(e) => setRequiredHours(Number(e.target.value))}
              min={1}
              max={24}
              step={0.5}
              className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
            <span className="text-sm text-gray-500">시간</span>
          </div>
        </div>
      </div>

      {/* 점심시간 */}
      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-900">점심시간</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">시작 시간</label>
            <select
              value={lunchStart}
              onChange={(e) => setLunchStart(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              {TIME_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">점심시간 길이</label>
            <div className="flex gap-2">
              {LUNCH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLunchDuration(opt.value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    lunchDuration === opt.value
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {lunchStart} ~ {(() => {
            const [h, m] = lunchStart.split(":").map(Number);
            const total = h * 60 + m + lunchDuration;
            return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
          })()} ({lunchDuration}분)
        </p>
      </div>

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
  );
}
