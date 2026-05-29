"use client";

import { useT } from "@/lib/i18n";

type Props = {
  isClockedIn: boolean;
  clockInTime: string | null;
};

export default function ClockButton({ isClockedIn, clockInTime }: Props) {
  const t = useT();

  function getElapsed() {
    if (!clockInTime) return null;
    const diff = Date.now() - new Date(clockInTime).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}${t("common.hours")} ${m}${t("common.minutes")}`;
  }

  return (
    <div>
      <p className="text-sm text-gray-500">{t("clock.currentStatus")}</p>
      <div className="mt-1 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${isClockedIn ? "bg-status-online" : "bg-gray-300"}`} />
        <span className="text-base font-medium text-gray-900">
          {isClockedIn ? t("clock.working") : t("clock.offWork")}
        </span>
      </div>
      {isClockedIn && clockInTime && (
        <p className="mt-1 text-xs text-gray-400">
          {new Date(clockInTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} {t("clock.clockedIn")}
          {" · "}
          {getElapsed()} {t("clock.elapsed")}
        </p>
      )}
    </div>
  );
}
