"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "./notification-actions";
import { useT } from "@/lib/i18n";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationButton() {
  const t = useT();

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t("notification.justNow");
    if (minutes < 60) return `${minutes}${t("notification.minutesAgo")}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}${t("notification.hoursAgo")}`;
    const days = Math.floor(hours / 24);
    return `${days}${t("notification.daysAgo")}`;
  }

  const TITLE_MAP: Record<string, string> = {
    "새 프로젝트에 배정되었습니다": t("notification.newProject"),
    "프로젝트에 배정되었습니다": t("notification.projectAssigned"),
    "새 태스크가 배정되었습니다": t("notification.taskAssigned"),
  };

  function translateTitle(title: string) {
    if (TITLE_MAP[title]) return TITLE_MAP[title];
    const commentMatch = title.match(/^"(.+)"에 새 댓글$/);
    if (commentMatch) return `${t("notification.newComment")} "${commentMatch[1]}"`;
    return title;
  }

  function translateMessage(message: string | null) {
    if (!message) return null;
    // "OOO님이 "프로젝트명" 프로젝트에 담당자로 배정했습니다."
    const projMatch = message.match(/^(.+)님이 "(.+)" 프로젝트에 담당자로 배정했습니다\.$/);
    if (projMatch) return `${projMatch[1]} ${t("notification.assignedYou")} "${projMatch[2]}" ${t("notification.projectSuffix")}`;
    // "OOO님이 "태스크명" 태스크를 배정했습니다."
    const taskMatch = message.match(/^(.+)님이 "(.+)" 태스크를 배정했습니다\.$/);
    if (taskMatch) return `${taskMatch[1]} ${t("notification.assignedTask")} "${taskMatch[2]}"`;
    // "OOO: 댓글내용" — 이건 이름: 내용이라 그대로 표시
    return message;
  }

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const loadNotifications = useCallback(async () => {
    const data = await getNotifications();
    setNotifications(data as Notification[]);
    setLoaded(true);
  }, []);

  // 초기 로드 + 탭 포커스 시에만 60초 폴링
  useEffect(() => {
    loadNotifications();
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!interval) {
        interval = setInterval(loadNotifications, 60000);
      }
    };
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        loadNotifications();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((prev) => !prev);
  }

  async function handleClick(notification: Notification) {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
    }
    if (notification.link) {
      router.push(notification.link);
      setOpen(false);
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-80 rounded-2xl border border-gray-200 bg-white"
          style={{ top: pos.top, right: pos.right }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{t("notification.title")}</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                {t("notification.markAllRead")}
              </button>
            )}
          </div>
          <div className="h-px bg-gray-100" />
          {!loaded ? (
            <div className="flex items-center justify-center px-4 py-10">
              <p className="text-sm text-gray-600">{t("common.loading")}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex items-center justify-center px-4 py-10">
              <p className="text-sm text-gray-600">{t("notification.empty")}</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                    !n.is_read ? "bg-blue-50/50" : ""
                  }`}
                >
                  <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${!n.is_read ? "bg-blue-500" : "bg-transparent"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!n.is_read ? "font-medium text-gray-900" : "text-gray-700"}`}>
                      {translateTitle(n.title)}
                    </p>
                    {n.message && (
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{translateMessage(n.message)}</p>
                    )}
                    <p className="mt-1 text-[11px] text-gray-600">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
