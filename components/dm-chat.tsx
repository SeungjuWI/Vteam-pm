"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Avatar from "@/components/avatar";
import {
  getMessages,
  sendMessage,
  markAsRead,
  translateSingleMessage,
  requestBotReply,
} from "@/app/(dashboard)/dm/actions";
import { createClient } from "@/lib/supabase/client";
import { LANGUAGES } from "@/lib/languages";
import { useT } from "@/lib/i18n";
import { setChatActive } from "@/lib/active-chat";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  sender_language?: string | null;
  translated_content?: string | null;
  is_read: boolean;
  created_at: string;
}

interface ChatMember {
  id: string;
  name: string;
  avatar_url: string | null;
  position: string | null;
  presence: string | null;
  language?: string | null;
  is_bot?: boolean | null;
}

const presenceKeys: Record<string, "dm.online" | "dm.away" | "dm.offline"> = {
  online: "dm.online",
  away: "dm.away",
  offline: "dm.offline",
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 봇 메시지용 간단한 마크다운 렌더러
function ChatMarkdown({ text, isMine }: { text: string; isMine: boolean }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const Tag = listOrdered ? "ol" : "ul";
    elements.push(
      <Tag key={key++} className={`my-1 space-y-0.5 pl-4 ${listOrdered ? "list-decimal" : "list-disc"}`}>
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </Tag>
    );
    listItems = [];
  };

  const renderInline = (line: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // **bold** 과 일반 텍스트 분리
    const regex = /\*\*(.+?)\*\*/g;
    let lastIdx = 0;
    let match;
    let i = 0;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIdx) {
        parts.push(<span key={i++}>{line.slice(lastIdx, match.index)}</span>);
      }
      parts.push(
        <span key={i++} className="font-semibold">{match[1]}</span>
      );
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < line.length) {
      parts.push(<span key={i++}>{line.slice(lastIdx)}</span>);
    }
    return parts.length > 0 ? parts : [line];
  };

  for (const line of lines) {
    const trimmed = line.trimStart();

    // 번호 리스트: 1. 2. 3. ...
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (orderedMatch) {
      if (listItems.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(orderedMatch[2]);
      continue;
    }

    // 불릿 리스트: - ...
    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (unorderedMatch) {
      if (listItems.length > 0 && listOrdered) flushList();
      listOrdered = false;
      listItems.push(unorderedMatch[1]);
      continue;
    }

    flushList();

    // 빈 줄
    if (trimmed === "") {
      elements.push(<div key={key++} className="h-1.5" />);
      continue;
    }

    // ### 헤더 (h3 이하만 지원)
    const headerMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (headerMatch) {
      elements.push(
        <div key={key++} className="font-semibold">{renderInline(headerMatch[1])}</div>
      );
      continue;
    }

    // 일반 텍스트
    elements.push(<div key={key++}>{renderInline(trimmed)}</div>);
  }

  flushList();

  return <div className="space-y-0.5">{elements}</div>;
}

const MIN_W = 280;
const MAX_W = 520;
const MIN_H = 320;
const MAX_H = 640;

// 우클릭 컨텍스트 메뉴
function ContextMenu({
  x,
  y,
  label,
  onViewOriginal,
  onClose,
}: {
  x: number;
  y: number;
  label: string;
  onViewOriginal: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] min-w-32 rounded-lg border border-gray-200 bg-white py-1"
      style={{ top: y, left: x }}
    >
      <button
        onClick={() => {
          onViewOriginal();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
        </svg>
        {label}
      </button>
    </div>
  );
}

// 원문 보기 팝업
function OriginalPopup({
  original,
  senderLang,
  labelText,
  onClose,
}: {
  original: string;
  senderLang: string;
  labelText: string;
  onClose: () => void;
}) {
  const lang = LANGUAGES.find((l) => l.code === senderLang);

  return (
    <div className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] text-gray-600">
          {labelText} {lang ? `${lang.flag} ${lang.label}` : ""}
        </span>
        <button onClick={onClose} className="text-gray-300 transition-colors hover:text-gray-500 active:scale-[0.95]">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-gray-600">{original}</p>
    </div>
  );
}

export default function DmChat({
  member,
  currentUserId,
  currentUserLang,
  onClose,
  onMinimize,
  isMinimized,
  style,
}: {
  member: ChatMember;
  currentUserId: string;
  currentUserLang: string;
  onClose: () => void;
  onMinimize: () => void;
  isMinimized: boolean;
  style?: React.CSSProperties;
}) {
  const t = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState({ w: 320, h: 420 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string } | null>(null);
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resizingRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const ASPECT = 420 / 320;

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
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          // 나에게 온 메시지만 수신 (회사 전체 INSERT를 받아 클라에서 거르던 부하 제거)
          filter: `receiver_id=eq.${currentUserId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (payload: any) => {
          const msg = payload.new as Message;

          // 현재 열린 대화 상대가 보낸 메시지만 처리 (내가 보낸 건 낙관적 업데이트로 이미 표시됨)
          if (msg.sender_id !== member.id) return;

          if (msg.sender_language && msg.sender_language !== currentUserLang) {
            const result = await translateSingleMessage(
              msg.id,
              msg.content,
              msg.sender_language
            );
            msg.translated_content = result.translated ?? null;
          }

          setMessages((prev) => [...prev, msg]);
          if (member.is_bot) setBotTyping(false);
          setTimeout(scrollToBottom, 50);
          markAsRead(member.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [member.id, currentUserId, currentUserLang, scrollToBottom]);

  // 포커스 시 읽음 처리
  useEffect(() => {
    if (!isMinimized) {
      markAsRead(member.id);
      inputRef.current?.focus();
    }
  }, [isMinimized, member.id]);

  // "보는 중" 등록 → 전역 알림 훅이 이 대화엔 소리 중복을 내지 않음
  useEffect(() => {
    const key = `dm-${member.id}`;
    setChatActive(key, !isMinimized);
    return () => setChatActive(key, false);
  }, [member.id, isMinimized]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      receiver_id: member.id,
      content: text,
      sender_language: currentUserLang,
      translated_content: null,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToBottom, 50);

    const result = await sendMessage(member.id, text);
    setSending(false);
    if (result.error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } else if (member.is_bot) {
      setBotTyping(true);
      setTimeout(scrollToBottom, 50);
      // 별도 서버 액션으로 봇 응답 요청 (Realtime으로 수신됨)
      requestBotReply(member.id, text).finally(() => {
        setBotTyping(false);
      });
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, msg: Message) => {
    // 번역된 메시지에만 우클릭 메뉴
    if (!msg.translated_content) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, msgId: msg.id });
  }, []);

  const toggleOriginal = useCallback((msgId: string) => {
    setShowOriginal((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  // 메시지 리스트는 messages/showOriginal 변경 시에만 재계산
  // (입력창 타이핑 등 다른 state 변경 시 버블 전체 재렌더 방지)
  const messageList = useMemo(
    () =>
      messages.map((msg, idx) => {
        const isMine = msg.sender_id === currentUserId;
        const hasTranslation = !!msg.translated_content;
        const displayText = hasTranslation ? msg.translated_content! : msg.content;
        const isShowingOriginal = showOriginal.has(msg.id);

        // 같은 시간 + 같은 발신자의 연속 메시지면 마지막 것만 시간 표시
        const time = formatTime(msg.created_at);
        const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
        const showTime =
          !nextMsg ||
          nextMsg.sender_id !== msg.sender_id ||
          formatTime(nextMsg.created_at) !== time;

        return (
          <div
            key={msg.id}
            className={`flex ${isMine ? "justify-end" : "justify-start"} ${showTime || hasTranslation ? "mb-3" : "mb-1"}`}
          >
            <div className={`flex max-w-[75%] flex-col ${isMine ? "items-end" : "items-start"}`}>
              <div
                onContextMenu={(e) => handleContextMenu(e, msg)}
                className={`select-text rounded-2xl px-3 py-2 text-sm ${
                  isMine
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-900"
                } ${hasTranslation ? "cursor-context-menu" : ""}`}
              >
                {!isMine && member.is_bot ? (
                  <ChatMarkdown text={displayText} isMine={isMine} />
                ) : (
                  displayText
                )}
              </div>
              {(showTime || hasTranslation) && (
                <div className="flex items-center gap-1.5">
                  {showTime && (
                    <span className="mt-0.5 text-[10px] text-gray-300">
                      {time}
                    </span>
                  )}
                  {hasTranslation && (
                    <span className="mt-0.5 text-[10px] text-blue-300">{t("dm.translated")}</span>
                  )}
                </div>
              )}
              {/* 원문 보기 */}
              {isShowingOriginal && hasTranslation && (
                <OriginalPopup
                  original={msg.content}
                  senderLang={msg.sender_language ?? ""}
                  labelText={t("dm.original")}
                  onClose={() => toggleOriginal(msg.id)}
                />
              )}
            </div>
          </div>
        );
      }),
    [messages, showOriginal, currentUserId, member.is_bot, t, handleContextMenu, toggleOriginal]
  );

  const isTranslated = member.language && member.language !== currentUserLang;

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
      {/* 리사이즈 핸들 */}
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
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-900">{member.name}</span>
              {member.is_bot && (
                <span className="flex h-4 items-center rounded-full bg-violet-100 px-1.5 text-[10px] font-medium text-violet-600">
                  AI
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <span>{member.is_bot ? t("dm.alwaysOnline") : t(presenceKeys[member.presence ?? "offline"] ?? "dm.offline")}</span>
              {isTranslated && (
                <>
                  <span className="text-gray-200">·</span>
                  <span className="flex items-center gap-0.5">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                    </svg>
                    {t("dm.autoTranslate")}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-[0.95]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-[0.95]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-600">
            {t("common.loading")}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Avatar url={member.avatar_url} name={member.name} size={48} />
            <p className="text-xs text-gray-600">
              {member.is_bot
                ? t("dm.askAnything")
                : `${member.name} ${t("dm.startChat")}`}
            </p>
          </div>
        ) : (
          <>
          {messageList}
          {botTyping && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl bg-gray-100 px-4 py-2.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
              </div>
            </div>
          )}
          </>
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
            placeholder={member.is_bot ? t("dm.askSean") : t("dm.typeMessage")}
            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          label={t("dm.viewOriginal")}
          onViewOriginal={() => toggleOriginal(contextMenu.msgId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
