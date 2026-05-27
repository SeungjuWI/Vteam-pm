"use client";

import { useState } from "react";
import { saveLeaveSettings } from "./actions";

type Props = {
  current: {
    auto_grant: boolean;
    default_annual_days: number;
    grant_basis: string;
  } | null;
  onSaved?: () => void;
};

export default function LeaveSettings({ current, onSaved }: Props) {
  const [autoGrant, setAutoGrant] = useState(current?.auto_grant ?? true);
  const [defaultDays, setDefaultDays] = useState(current?.default_annual_days ?? 15);
  const [grantBasis, setGrantBasis] = useState(current?.grant_basis ?? "join_date");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await saveLeaveSettings(formData);
    if (result?.success) {
      onSaved?.();
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl bg-white p-6">
      <h2 className="mb-4 text-sm font-medium text-gray-900">연차 제도 설정</h2>
      <form action={handleSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="autoGrant" value={String(autoGrant)} />
        <input type="hidden" name="grantBasis" value={grantBasis} />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-900">자동 부여</p>
            <p className="text-xs text-gray-500">멤버에게 연차를 자동으로 부여합니다</p>
          </div>
          <button
            type="button"
            onClick={() => setAutoGrant(!autoGrant)}
            className={`relative h-6 w-11 rounded-full transition-colors ${autoGrant ? "bg-blue-500" : "bg-gray-300"}`}
          >
            <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${autoGrant ? "translate-x-5.5" : "translate-x-0.5"}`} />
          </button>
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
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">부여 기준</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGrantBasis("join_date")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    grantBasis === "join_date" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  입사일 기준
                </button>
                <button
                  type="button"
                  onClick={() => setGrantBasis("fiscal_year")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    grantBasis === "fiscal_year" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  회계연도 기준
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {grantBasis === "join_date"
                  ? "입사일 기준으로 근속년수에 따라 연차가 추가 부여됩니다 (3년차부터 2년마다 +1일)"
                  : "매년 1월 1일 기준으로 동일하게 부여됩니다"}
              </p>
            </div>
          </>
        )}

        {!autoGrant && <input type="hidden" name="defaultDays" value={defaultDays} />}

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
