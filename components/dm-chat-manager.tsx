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
  language?: string | null;
  is_bot?: boolean | null;
}

interface ChatWindow {
  member: ChatMember;
  minimized: boolean;
}

const MAX_CHATS = 3;

export default function DmChatManager({
  currentUserId,
  currentUserLang,
}: {
  currentUserId: string;
  currentUserLang: string;
}) {
  const [chats, setChats] = useState<ChatWindow[]>([]);

  usePresence();

  const openChat = useCallback((member: ChatMember) => {
    setChats((prev) => {
      const existing = prev.find((c) => c.member.id === member.id);
      if (existing) {
        return prev.map((c) =>
          c.member.id === member.id ? { ...c, minimized: false } : c
        );
      }
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
      <SidebarTeamList onOpenChat={openChat} />

      <div className="fixed bottom-0 right-4 z-50 flex items-end gap-2">
        {chats.map((chat) => (
          <DmChat
            key={chat.member.id}
            member={chat.member}
            currentUserId={currentUserId}
            currentUserLang={currentUserLang}
            onClose={() => closeChat(chat.member.id)}
            onMinimize={() => toggleMinimize(chat.member.id)}
            isMinimized={chat.minimized}
          />
        ))}
      </div>
    </>
  );
}
