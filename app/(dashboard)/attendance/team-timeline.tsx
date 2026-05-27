"use client";

type TeamRecord = {
  name: string;
  email: string;
  clockIn: string;
  clockOut: string | null;
};

const HOUR_START = 7;
const HOUR_END = 22;
const TOTAL_HOURS = HOUR_END - HOUR_START;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function getDuration(clockIn: string, clockOut: string | null) {
  const end = clockOut ? new Date(clockOut).getTime() : Date.now();
  const diff = end - new Date(clockIn).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}시간 ${m}분`;
}

function getBarStyle(clockIn: string, clockOut: string | null) {
  const startDate = new Date(clockIn);
  const endDate = clockOut ? new Date(clockOut) : new Date();

  const startHour = startDate.getHours() + startDate.getMinutes() / 60;
  const endHour = endDate.getHours() + endDate.getMinutes() / 60;

  const left = Math.max(0, ((startHour - HOUR_START) / TOTAL_HOURS) * 100);
  const right = Math.min(100, ((endHour - HOUR_START) / TOTAL_HOURS) * 100);
  const width = Math.max(0, right - left);

  return { left: `${left}%`, width: `${width}%` };
}

export default function TeamTimeline({ records }: { records: TeamRecord[] }) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => HOUR_START + i);

  return (
    <div className="rounded-xl bg-white">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-sm font-medium text-gray-900">팀원 근무 현황</h2>
      </div>

      {records.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-gray-400">오늘 출근한 팀원이 없습니다</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* 시간 헤더 */}
          <div className="flex min-w-[800px]">
            <div className="w-48 shrink-0" />
            <div className="relative flex flex-1">
              {hours.map((h) => (
                <div
                  key={h}
                  className="flex-1 border-l border-gray-100 py-2 text-center text-xs text-gray-400"
                >
                  {h}
                </div>
              ))}
            </div>
          </div>

          {/* 멤버 행 */}
          <div className="divide-y divide-gray-50">
            {records.map((record, i) => {
              const isWorking = !record.clockOut;
              const barStyle = getBarStyle(record.clockIn, record.clockOut);

              return (
                <div key={i} className="flex min-w-[800px] items-center">
                  {/* 프로필 */}
                  <div className="flex w-48 shrink-0 items-center gap-3 px-6 py-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {record.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{record.name}</p>
                      <p className="text-xs text-blue-500">{getDuration(record.clockIn, record.clockOut)}</p>
                    </div>
                  </div>

                  {/* 타임라인 바 */}
                  <div className="relative flex-1 py-4 pr-4">
                    <div className="relative h-10 rounded-lg bg-gray-50">
                      {/* 시간 구분선 */}
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="absolute top-0 h-full border-l border-gray-100"
                          style={{ left: `${((h - HOUR_START) / TOTAL_HOURS) * 100}%` }}
                        />
                      ))}
                      {/* 근무 바 */}
                      <div
                        className={`absolute top-1 h-8 rounded-md px-2.5 py-1 ${
                          isWorking ? "bg-emerald-100" : "bg-blue-50"
                        }`}
                        style={barStyle}
                      >
                        <div className="flex h-full items-center gap-1.5 overflow-hidden">
                          {isWorking && (
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          )}
                          <span className={`truncate text-xs font-medium ${isWorking ? "text-emerald-700" : "text-blue-600"}`}>
                            {formatTime(record.clockIn)}
                            {record.clockOut ? ` - ${formatTime(record.clockOut)}` : " ~"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
