"use client";

import { useT, useLocale } from "@/lib/i18n";

type Props = {
  isClockedIn: boolean;
  clockInTime: string | null;
  ipBlocked?: boolean;
  currentIp?: string | null;
};

export default function ClockButton({ isClockedIn, clockInTime, ipBlocked, currentIp }: Props) {
  const t = useT();
  const locale = useLocale();

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
        <p className="mt-1 text-xs text-gray-400" suppressHydrationWarning>
          {new Date(clockInTime).toLocaleTimeString(locale === "en" ? "en-US" : "ko-KR", { hour: "2-digit", minute: "2-digit" })} {t("clock.clockedIn")}
          {" · "}
          {getElapsed()} {t("clock.elapsed")}
        </p>
      )}

      {ipBlocked && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-xs font-medium text-amber-700">{t("clock.ipBlockedTitle")}</p>
          <p className="mt-0.5 text-[11px] text-amber-600">
            {t("clock.ipBlockedDesc")}
            {currentIp ? ` (${t("ipPolicy.currentIp")} ${currentIp})` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
