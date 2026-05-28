"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { updatePresence } from "@/app/(dashboard)/dm/actions";

export function usePresence() {
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceRef = useRef<"online" | "away" | "offline">("online");

  const setPresence = useCallback(
    async (status: "online" | "away" | "offline") => {
      if (presenceRef.current === status) return;
      presenceRef.current = status;
      await updatePresence(status);
    },
    []
  );

  useEffect(() => {
    setPresence("online");

    // 탭 가시성 변화 감지
    const handleVisibility = () => {
      if (document.hidden) {
        setPresence("away");
      } else {
        setPresence("online");
      }
    };

    // 유저 활동 감지 (away -> online)
    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      if (presenceRef.current === "away" && !document.hidden) {
        setPresence("online");
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!document.hidden) setPresence("away");
      }, 5 * 60 * 1000); // 5분 비활동시 away
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("mousemove", resetIdle);
    window.addEventListener("keydown", resetIdle);

    // 주기적 heartbeat (30초)
    const heartbeat = setInterval(() => {
      if (presenceRef.current !== "offline") {
        updatePresence(presenceRef.current);
      }
    }, 30_000);

    // 오프라인 처리
    const handleBeforeUnload = () => {
      // navigator.sendBeacon으로 오프라인 전송
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/set_offline`;
      // 간단히 presence 업데이트 (서버에서 자동 감지)
      setPresence("offline");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearTimeout(idleTimer);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("mousemove", resetIdle);
      window.removeEventListener("keydown", resetIdle);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      setPresence("offline");
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [supabase, setPresence]);
}
