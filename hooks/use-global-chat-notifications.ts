"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getChatNotifyContext,
  getTotalChatUnread,
} from "@/app/(dashboard)/chat-notify-actions";
import { isChatActive } from "@/lib/active-chat";
import {
  playNotificationSound,
  requestNotificationPermission,
  showBrowserNotification,
} from "@/lib/notification-sound";

// 탭 타이틀 앞에 (N) 뱃지를 붙이거나 제거한다. (Next.js가 페이지 제목을
// 바꿔도 다음 갱신 때 다시 적용되도록 항상 기존 prefix를 떼고 새로 붙임)
function setTitleBadge(count: number) {
  if (typeof document === "undefined") return;
  const stripped = document.title.replace(/^\(\d+\)\s*/, "");
  document.title = count > 0 ? `(${count}) ${stripped}` : stripped;
}

interface Incoming {
  key: string; // active-chat 레지스트리 키
  senderId: string;
  content: string;
}

// 페이지 어디에 있든(채팅창을 안 열어둬도) 들어오는 모든 메시지를 듣고
// 소리 · 브라우저 알림 · 탭 타이틀(N) 뱃지를 갱신하는 전역 리스너.
export function useGlobalChatNotifications(currentUserId: string) {
  const ctxRef = useRef<{
    names: Record<string, string>;
    roomIds: Set<string>;
    channelIds: Set<string>;
  }>({ names: {}, roomIds: new Set(), channelIds: new Set() });

  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 미읽음 합계 → 타이틀 갱신 (가벼운 디바운스로 연속 이벤트 합침)
  const refreshTitle = useRef(() => {
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      getTotalChatUnread().then(setTitleBadge);
    }, 500);
  }).current;

  // 알림 권한 요청 + 컨텍스트 로드 + 초기 타이틀
  useEffect(() => {
    requestNotificationPermission();

    let cancelled = false;
    getChatNotifyContext().then((c) => {
      if (cancelled) return;
      ctxRef.current = {
        names: c.names,
        roomIds: new Set(c.roomIds),
        channelIds: new Set(c.channelIds),
      };
    });
    refreshTitle();

    return () => {
      cancelled = true;
    };
  }, [refreshTitle]);

  // 탭으로 돌아오면(읽음 처리 후) 타이틀을 다시 맞춤
  useEffect(() => {
    const onFocus = () => refreshTitle();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshTitle]);

  // 실시간 구독
  useEffect(() => {
    const supabase = createClient();

    const handle = ({ key, senderId, content }: Incoming) => {
      if (senderId === currentUserId) return; // 내가 보낸 건 제외

      const viewing =
        isChatActive(key) &&
        typeof document !== "undefined" &&
        document.hasFocus();

      // 보고 있는 대화는 잠시 뒤 읽음 처리가 끝나면 타이틀이 0으로 맞춰짐
      refreshTitle();

      if (viewing) return; // 지금 보고 있으면 소리/알림 생략

      const name = ctxRef.current.names[senderId] ?? "새 메시지";
      playNotificationSound();
      // 탭이 백그라운드일 때만 실제 OS 알림 (함수 내부에서 자체 판단)
      showBrowserNotification(name, content);
    };

    const channel = supabase
      .channel("global-chat-notify")
      // 1) 개인 DM — 나에게 온 것만 서버 필터
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const m = payload.new;
          handle({
            key: `dm-${m.sender_id}`,
            senderId: m.sender_id,
            content: m.content,
          });
        }
      )
      // 2) 단체 DM — 내가 속한 방만 클라에서 필터
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_dm_messages" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const m = payload.new;
          if (!ctxRef.current.roomIds.has(m.room_id)) return;
          handle({
            key: `group-${m.room_id}`,
            senderId: m.sender_id,
            content: m.content,
          });
        }
      )
      // 3) 부서 채널 — 내가 속한 채널만 클라에서 필터
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dept_channel_messages" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const m = payload.new;
          if (!ctxRef.current.channelIds.has(m.channel_id)) return;
          handle({
            key: `channel-${m.channel_id}`,
            senderId: m.sender_id,
            content: m.content,
          });
        }
      )
      // 읽음 처리(타 테이블 UPDATE)로 미읽음이 줄면 타이틀도 갱신
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages" },
        () => refreshTitle()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_dm_members" },
        () => refreshTitle()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, refreshTitle]);
}
