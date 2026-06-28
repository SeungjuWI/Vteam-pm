"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  playNotificationSound,
  requestNotificationPermission,
  showBrowserNotification,
} from "@/lib/notification-sound";

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
