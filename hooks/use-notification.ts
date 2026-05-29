"use client";

import { useCallback, useEffect, useRef } from "react";

// Web Audio API로 알림 소리 생성 (외부 파일 불필요)
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    // 슬랙 스타일 알림음: 짧고 부드러운 두 음
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
    oscillator.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.08); // C6

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);

    oscillator.onended = () => ctx.close();
  } catch {
    // AudioContext를 지원하지 않는 환경에서는 무시
  }
}

function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;

  const notification = new Notification(title, {
    body: body.length > 100 ? body.slice(0, 100) + "..." : body,
    icon: "/icon.png",
    tag: "vteam-message",
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  setTimeout(() => notification.close(), 5000);
}

export function useNotification() {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      requestNotificationPermission();
    }
  }, []);

  const notify = useCallback((senderName: string, message: string) => {
    playNotificationSound();
    showBrowserNotification(senderName, message);
  }, []);

  return { notify };
}
