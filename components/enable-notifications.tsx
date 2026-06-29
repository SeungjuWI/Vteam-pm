"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n";

type Perm = "default" | "granted" | "denied" | "unsupported";

// 헤더의 "알림 켜기" 버튼.
// - 권한이 아직 default면 클릭 시 브라우저 권한 요청
// - 이미 granted면 아무것도 표시하지 않음 (이미 알림이 옴)
// - denied면 브라우저 설정에서 켜라고 안내
export default function EnableNotifications() {
  const t = useT();
  const [perm, setPerm] = useState<Perm>("granted"); // SSR/초기엔 숨김

  useEffect(() => {
    const next: Perm =
      typeof window === "undefined" || !("Notification" in window)
        ? "unsupported"
        : (Notification.permission as Perm);
    // 마운트 후 브라우저 권한을 한 번 읽어 반영 (의도된 동기화)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerm(next);
  }, []);

  if (perm === "granted" || perm === "unsupported") return null;

  const handleClick = async () => {
    if (perm === "denied") {
      toast.info(t("notification.blocked"));
      return;
    }
    const result = await Notification.requestPermission();
    setPerm(result as Perm);
  };

  return (
    <button
      onClick={handleClick}
      title={t("notification.enableTitle")}
      className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 active:scale-[0.97]"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
      {t("notification.enable")}
    </button>
  );
}
