"use client";

import { useState, useCallback } from "react";
import DmChat from "@/components/dm-chat";
import GroupDmChat from "@/components/group-dm-chat";
import SidebarTeamList from "@/components/sidebar-team-list";
import { usePresence } from "@/hooks/use-presence";
import { useGlobalChatNotifications } from "@/hooks/use-global-chat-notifications";

interface ChatMember {
  id: string;
  name: string;
  avatar_url: string | null;
  position: string | null;
  presence: string | null;
  language?: string | null;
  is_bot?: boolean | null;
}

interface GroupDmRoom {
  id: string;
  name: string;
  memberCount: number;
  members: {
    id: string;
    name: string;
    avatar_url: string | null;
    presence?: string | null;
    language?: string | null;
  }[];
}

interface ChatWindow {
  type: "dm";
  member: ChatMember;
  minimized: boolean;
}

interface GroupChatWindow {
  type: "group";
  room: GroupDmRoom;
  minimized: boolean;
}

type AnyChat = ChatWindow | GroupChatWindow;

const MAX_CHATS = 3;

function getChatKey(chat: AnyChat): string {
  return chat.type === "dm" ? `dm-${chat.member.id}` : `group-${chat.room.id}`;
}

export default function DmChatManager({
  currentUserId,
  currentUserLang,
}: {
  currentUserId: string;
  currentUserLang: string;
}) {
  const [chats, setChats] = useState<AnyChat[]>([]);

  usePresence();
  // 어느 페이지에 있든(채팅창을 안 열어둬도) 전역으로 메시지를 듣고
  // 소리 · 브라우저 알림 · 탭 타이틀(N) 뱃지를 갱신
  useGlobalChatNotifications(currentUserId);

  const openChat = useCallback((member: ChatMember) => {
    setChats((prev) => {
      const key = `dm-${member.id}`;
      const existing = prev.find((c) => getChatKey(c) === key);
      if (existing) {
        return prev.map((c) =>
          getChatKey(c) === key ? { ...c, minimized: false } : c
        );
      }
      const next = prev.length >= MAX_CHATS ? prev.slice(1) : prev;
      return [...next, { type: "dm" as const, member, minimized: false }];
    });
  }, []);

  const openGroupChat = useCallback((room: GroupDmRoom) => {
    setChats((prev) => {
      const key = `group-${room.id}`;
      const existing = prev.find((c) => getChatKey(c) === key);
      if (existing) {
        return prev.map((c) =>
          getChatKey(c) === key ? { ...c, minimized: false } : c
        );
      }
      const next = prev.length >= MAX_CHATS ? prev.slice(1) : prev;
      return [...next, { type: "group" as const, room, minimized: false }];
    });
  }, []);

  const closeChat = useCallback((key: string) => {
    setChats((prev) => prev.filter((c) => getChatKey(c) !== key));
  }, []);

  const toggleMinimize = useCallback((key: string) => {
    setChats((prev) =>
      prev.map((c) =>
        getChatKey(c) === key ? { ...c, minimized: !c.minimized } : c
      )
    );
  }, []);

  return (
    <>
      <SidebarTeamList
        onOpenChat={openChat}
        onOpenGroupChat={openGroupChat}
        currentUserId={currentUserId}
      />

      <div className="fixed bottom-0 right-4 z-50 flex items-end gap-2">
        {chats.map((chat) => {
          const key = getChatKey(chat);
          if (chat.type === "dm") {
            return (
              <DmChat
                key={key}
                member={chat.member}
                currentUserId={currentUserId}
                currentUserLang={currentUserLang}
                onClose={() => closeChat(key)}
                onMinimize={() => toggleMinimize(key)}
                isMinimized={chat.minimized}
              />
            );
          }
          return (
            <GroupDmChat
              key={key}
              room={chat.room}
              currentUserId={currentUserId}
              currentUserLang={currentUserLang}
              onClose={() => closeChat(key)}
              onMinimize={() => toggleMinimize(key)}
              isMinimized={chat.minimized}
            />
          );
        })}
      </div>
    </>
  );
}
