"use client";

type Props = {
  isClockedIn: boolean;
  clockInTime: string | null;
};

export default function ClockButton({ isClockedIn, clockInTime }: Props) {
  function getElapsed() {
    if (!clockInTime) return null;
    const diff = Date.now() - new Date(clockInTime).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}시간 ${m}분`;
  }

  return (
    <div>
      <p className="text-sm text-gray-500">현재 상태</p>
      <div className="mt-1 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${isClockedIn ? "bg-status-online" : "bg-gray-300"}`} />
        <span className="text-base font-medium text-gray-900">
          {isClockedIn ? "근무 중" : "퇴근"}
        </span>
      </div>
      {isClockedIn && clockInTime && (
        <p className="mt-1 text-xs text-gray-400">
          {new Date(clockInTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 출근
          {" · "}
          {getElapsed()} 경과
        </p>
      )}
    </div>
  );
}
