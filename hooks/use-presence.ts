"use client";

import { useEffect, useRef, useCallback } from "react";
import { updatePresence } from "@/app/(dashboard)/dm/actions";

export function usePresence() {
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

    const handleVisibility = () => {
      if (document.hidden) {
        setPresence("away");
      } else {
        setPresence("online");
      }
    };

    let idleTimer: ReturnType<typeof setTimeout>;
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const resetIdle = () => {
      // mousemove 쓰로틀: 1초에 한 번만 처리
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 1000);

      if (presenceRef.current === "away" && !document.hidden) {
        setPresence("online");
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!document.hidden) setPresence("away");
      }, 5 * 60 * 1000);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("mousemove", resetIdle);
    window.addEventListener("keydown", resetIdle);

    // 하트비트 60초 (탭이 보일 때만)
    const heartbeat = setInterval(() => {
      if (presenceRef.current !== "offline" && !document.hidden) {
        updatePresence(presenceRef.current);
      }
    }, 60_000);

    const handleBeforeUnload = () => {
      setPresence("offline");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearTimeout(idleTimer);
      if (throttleTimer) clearTimeout(throttleTimer);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("mousemove", resetIdle);
      window.removeEventListener("keydown", resetIdle);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      setPresence("offline");
    };
  }, [setPresence]);
}
