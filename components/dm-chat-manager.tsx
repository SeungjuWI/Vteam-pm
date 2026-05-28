"use client";

import { useState, useCallback } from "react";
import DmChat from "@/components/dm-chat";
import SidebarTeamList from "@/components/sidebar-team-list";
import { usePresence } from "@/hooks/use-presence";

interface ChatMember {
  id: string;
  name: string;
  avatar_url: string | null;
  position: string | null;
  presence: string | null;
}

interface ChatWindow {
  member: ChatMember;
  minimized: boolean;
}

const MAX_CHATS = 3;

export default function DmChatManager({ currentUserId }: { currentUserId: string }) {
  const [chats, setChats] = useState<ChatWindow[]>([]);

  // 프레즌스 추적 활성화
  usePresence();

  const openChat = useCallback((member: ChatMember) => {
    setChats((prev) => {
      // 이미 열려있으면 최소화 해제
      const existing = prev.find((c) => c.member.id === member.id);
      if (existing) {
        return prev.map((c) =>
          c.member.id === member.id ? { ...c, minimized: false } : c
        );
      }
      // 최대 개수 초과시 가장 오래된 것 제거
      const next = prev.length >= MAX_CHATS ? prev.slice(1) : prev;
      return [...next, { member, minimized: false }];
    });
  }, []);

  const closeChat = useCallback((memberId: string) => {
    setChats((prev) => prev.filter((c) => c.member.id !== memberId));
  }, []);

  const toggleMinimize = useCallback((memberId: string) => {
    setChats((prev) =>
      prev.map((c) =>
        c.member.id === memberId ? { ...c, minimized: !c.minimized } : c
      )
    );
  }, []);

  return (
    <>
      {/* 사이드바 팀원 리스트 */}
      <SidebarTeamList onOpenChat={openChat} />

      {/* 채팅 윈도우들 - 화면 우하단에 정렬 */}
      <div className="fixed bottom-0 right-4 z-50 flex items-end gap-2">
        {chats.map((chat, i) => (
          <DmChat
            key={chat.member.id}
            member={chat.member}
            currentUserId={currentUserId}
            onClose={() => closeChat(chat.member.id)}
            onMinimize={() => toggleMinimize(chat.member.id)}
            isMinimized={chat.minimized}
          />
        ))}
      </div>
    </>
  );
}
