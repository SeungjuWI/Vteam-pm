"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { exportAttendance, exportMembers, exportLeaves } from "./actions";

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

export default function ExportView() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleExport(type: "attendance" | "members" | "leaves") {
    setLoading(type);
    setError("");
    try {
      let result;
      if (type === "attendance") {
        result = await exportAttendance(startDate, endDate);
      } else if (type === "members") {
        result = await exportMembers();
      } else {
        result = await exportLeaves(startDate, endDate);
      }

      if ("error" in result && result.error) {
        setError(result.error);
      } else if ("csv" in result && result.csv && result.filename) {
        downloadCSV(result.csv, result.filename);
      }
    } catch {
      setError("내보내기에 실패했습니다.");
    }
    setLoading(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">데이터 내보내기</h1>
        <p className="mt-1 text-sm text-gray-500">
          근태, 멤버, 휴가 데이터를 CSV 파일로 내보냅니다.
        </p>
      </div>

      {/* 기간 선택 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-medium text-gray-900">기간 설정</h2>
        <div className="mt-3 flex items-center gap-3">
          <DatePicker
            value={startDate}
            onChange={(v) => setStartDate(v)}
          />
          <span className="text-sm text-gray-400">~</span>
          <DatePicker
            value={endDate}
            onChange={(v) => setEndDate(v)}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* 내보내기 카드 */}
      <div className="space-y-3">
        <ExportCard
          icon={
            <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="근태 데이터"
          description="선택한 기간의 출퇴근 기록을 내보냅니다. (이름, 출근/퇴근 시간, 근무시간, 메모)"
          loading={loading === "attendance"}
          onExport={() => handleExport("attendance")}
        />
        <ExportCard
          icon={
            <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
          title="멤버 목록"
          description="전체 멤버 정보를 내보냅니다. (이름, 이메일, 역할, 직책, 상태)"
          loading={loading === "members"}
          onExport={() => handleExport("members")}
        />
        <ExportCard
          icon={
            <svg className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          }
          title="휴가 데이터"
          description="선택한 기간의 휴가 신청 내역을 내보냅니다. (이름, 유형, 기간, 사유, 상태)"
          loading={loading === "leaves"}
          onExport={() => handleExport("leaves")}
        />
      </div>
    </div>
  );
}

function ExportCard({
  icon,
  title,
  description,
  loading,
  onExport,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  loading: boolean;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-50">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={onExport}
        disabled={loading}
        className="flex-shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800 disabled:bg-gray-300"
      >
        {loading ? "내보내는 중..." : "CSV 내보내기"}
      </button>
    </div>
  );
}
