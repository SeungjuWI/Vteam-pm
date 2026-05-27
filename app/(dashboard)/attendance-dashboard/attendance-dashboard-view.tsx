"use client";

const STATUS_CONFIG = {
  working: { label: "근무중", color: "bg-green-100 text-green-700" },
  done: { label: "퇴근", color: "bg-gray-100 text-gray-600" },
  absent: { label: "미출근", color: "bg-red-50 text-red-500" },
} as const;

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금"];

interface MemberStatus {
  id: string;
  name: string;
  position: string;
  avatarUrl: string;
  role: string;
  status: "working" | "done" | "absent";
  clockIn: string | null;
  clockOut: string | null;
}

interface DashboardData {
  totalMembers: number;
  todayClockedIn: number;
  todayWorking: number;
  todayDone: number;
  todayAbsent: number;
  lateCount: number;
  avgWorkHours: number;
  requiredHours: number;
  weekdayAttendance: number[];
  passedWorkdays: number;
  memberStatus: MemberStatus[];
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-medium ${accent ?? "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function formatTime(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AttendanceDashboardView({
  data,
}: {
  data: DashboardData;
}) {
  const attendanceRate =
    data.totalMembers > 0
      ? Math.round((data.todayClockedIn / data.totalMembers) * 100)
      : 0;

  const maxWeekday = Math.max(...data.weekdayAttendance, 1);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-medium text-gray-900">근태 대시보드</h1>
        <p className="mt-1 text-sm text-gray-500">
          오늘의 팀 출퇴근 현황을 한눈에 확인합니다.
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="출근율"
          value={`${attendanceRate}%`}
          sub={`${data.todayClockedIn} / ${data.totalMembers}명`}
          accent="text-blue-500"
        />
        <StatCard
          label="현재 근무중"
          value={`${data.todayWorking}명`}
          accent="text-green-600"
        />
        <StatCard
          label="미출근"
          value={`${data.todayAbsent}명`}
          accent={data.todayAbsent > 0 ? "text-red-500" : "text-gray-900"}
        />
        <StatCard
          label="지각"
          value={`${data.lateCount}명`}
          accent={data.lateCount > 0 ? "text-orange-500" : "text-gray-900"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 이번 주 출근 추이 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-900">이번 주 출근 추이</h2>
          <div className="mt-4 flex items-end gap-3">
            {WEEKDAY_LABELS.map((label, i) => {
              const count = data.weekdayAttendance[i];
              const height = maxWeekday > 0 ? (count / maxWeekday) * 120 : 0;
              const isPast = i < data.passedWorkdays;
              return (
                <div key={label} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{count}명</span>
                  <div
                    className={`w-full rounded-t-lg transition-all ${
                      isPast ? "bg-blue-400" : "bg-gray-100"
                    }`}
                    style={{ height: Math.max(height, 4) }}
                  />
                  <span className="text-xs text-gray-400">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 월 평균 근무시간 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-900">이번 달 평균 근무시간</h2>
          <div className="mt-6 flex items-center gap-4">
            <div className="relative h-28 w-28">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#f3f4f6"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke={data.avgWorkHours >= data.requiredHours ? "#3b82f6" : "#f59e0b"}
                  strokeWidth="3"
                  strokeDasharray={`${Math.min((data.avgWorkHours / data.requiredHours) * 97.4, 97.4)} 97.4`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-medium text-gray-900">
                  {data.avgWorkHours}h
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-400">평균 근무</p>
                <p className="text-sm font-medium text-gray-900">
                  {data.avgWorkHours}시간
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">기준 시간</p>
                <p className="text-sm font-medium text-gray-900">
                  {data.requiredHours}시간
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 멤버별 현황 */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-medium text-gray-900">멤버별 현황</h2>
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
              근무중 {data.todayWorking}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
              퇴근 {data.todayDone}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-300" />
              미출근 {data.todayAbsent}
            </span>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {data.memberStatus.map((m) => {
            const cfg = STATUS_CONFIG[m.status];
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 px-5 py-3"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatarUrl}
                      alt={m.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-medium text-gray-500">
                      {m.name[0]}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-900">{m.name}</p>
                  {m.position && (
                    <p className="truncate text-xs text-gray-400">
                      {m.position}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs text-gray-500">
                    <span>출근 {formatTime(m.clockIn)}</span>
                    <span className="mx-1 text-gray-300">|</span>
                    <span>퇴근 {formatTime(m.clockOut)}</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${cfg.color}`}
                  >
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
          {data.memberStatus.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              멤버가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
