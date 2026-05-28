"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Avatar from "@/components/avatar";
import { getMessages, sendMessage, markAsRead } from "@/app/(dashboard)/dm/actions";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface ChatMember {
  id: string;
  name: string;
  avatar_url: string | null;
  position: string | null;
  presence: string | null;
}

const presenceLabel: Record<string, string> = {
  online: "활동중",
  away: "자리비움",
  offline: "오프라인",
};

const MIN_W = 280;
const MAX_W = 520;
const MIN_H = 320;
const MAX_H = 640;

export default function DmChat({
  member,
  currentUserId,
  onClose,
  onMinimize,
  isMinimized,
  style,
}: {
  member: ChatMember;
  currentUserId: string;
  onClose: () => void;
  onMinimize: () => void;
  isMinimized: boolean;
  style?: React.CSSProperties;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState({ w: 320, h: 420 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resizingRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const ASPECT = 420 / 320; // h/w 비율 고정

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return;
        const { startX, startW } = resizingRef.current;
        const newW = Math.min(MAX_W, Math.max(MIN_W, startW - (ev.clientX - startX)));
        const newH = Math.min(MAX_H, Math.max(MIN_H, Math.round(newW * ASPECT)));
        setSize({ w: newW, h: newH });
      };

      const handleMouseUp = () => {
        resizingRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [size]
  );

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // 메시지 로드
  useEffect(() => {
    getMessages(member.id).then((data) => {
      setMessages(data as Message[]);
      setLoading(false);
      setTimeout(scrollToBottom, 50);
    });
    markAsRead(member.id);
  }, [member.id, scrollToBottom]);

  // Realtime 구독
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dm-${member.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const msg = payload.new as Message;
          // 이 채팅방에 해당하는 메시지만
          const isRelevant =
            (msg.sender_id === member.id && msg.receiver_id === currentUserId) ||
            (msg.sender_id === currentUserId && msg.receiver_id === member.id);
          if (isRelevant) {
            setMessages((prev) => [...prev, msg]);
            setTimeout(scrollToBottom, 50);
            // 상대방이 보낸 메시지면 읽음 처리
            if (msg.sender_id === member.id) {
              markAsRead(member.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [member.id, currentUserId, scrollToBottom]);

  // 포커스 시 읽음 처리
  useEffect(() => {
    if (!isMinimized) {
      markAsRead(member.id);
      inputRef.current?.focus();
    }
  }, [isMinimized, member.id]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    // 낙관적 업데이트
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      receiver_id: member.id,
      content: text,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToBottom, 50);

    const result = await sendMessage(member.id, text);
    setSending(false);
    if (result.error) {
      // 실패시 낙관적 메시지 제거
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  if (isMinimized) {
    return (
      <button
        onClick={onMinimize}
        className="flex items-center gap-2 rounded-t-xl border border-b-0 border-gray-200 bg-white px-4 py-2.5 transition-colors hover:bg-gray-50"
        style={style}
      >
        <div className="relative">
          <Avatar url={member.avatar_url} name={member.name} size={24} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${
              member.presence === "online"
                ? "bg-emerald-400"
                : member.presence === "away"
                  ? "bg-yellow-400"
                  : "bg-gray-300"
            }`}
          />
        </div>
        <span className="text-sm font-medium text-gray-700">{member.name}</span>
      </button>
    );
  }

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-t-xl border border-b-0 border-gray-200 bg-white"
      style={{ width: size.w, height: size.h, ...style }}
    >
      {/* 리사이즈 핸들 - 좌상단 모서리만 */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute left-0 top-0 z-10 h-4 w-4 cursor-nw-resize"
      />
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Avatar url={member.avatar_url} name={member.name} size={28} />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                member.presence === "online"
                  ? "bg-emerald-400"
                  : member.presence === "away"
                    ? "bg-yellow-400"
                    : "bg-gray-300"
              }`}
            />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{member.name}</div>
            <div className="text-[11px] text-gray-400">
              {presenceLabel[member.presence ?? "offline"] ?? "오프라인"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            불러오는 중...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Avatar url={member.avatar_url} name={member.name} size={48} />
            <p className="text-xs text-gray-400">
              {member.name}님과의 대화를 시작하세요
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex max-w-[75%] flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      isMine
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="mt-0.5 text-[10px] text-gray-300">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 입력 영역 */}
      <div className="border-t border-gray-100 px-3 py-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요..."
            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
