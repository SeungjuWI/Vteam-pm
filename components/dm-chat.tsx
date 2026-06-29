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
import {
  editDirectMessage,
  deleteDirectMessage,
  uploadChatAttachment,
} from "@/app/(dashboard)/chat-message-actions";
import { createClient } from "@/lib/supabase/client";
import { LANGUAGES } from "@/lib/languages";
import { useT } from "@/lib/i18n";
import { setChatActive } from "@/lib/active-chat";
import {
  AttachmentList,
  AttachmentButton,
  PendingAttachments,
  DropOverlay,
  useFileDrop,
  normalizeAttachments,
  MessageActions,
  EditBox,
  type AttachmentType,
  type Attachment,
} from "@/components/chat/message-extras";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  sender_language?: string | null;
  translated_content?: string | null;
  is_read: boolean;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  attachment_url?: string | null;
  attachment_type?: AttachmentType | null;
  attachment_name?: string | null;
  attachments?: Attachment[] | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
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
      // 상대가 메시지를 수정/삭제하면 반영 (나에게 온 메시지만)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_messages",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (payload: any) => {
          const msg = payload.new as Message;
          if (msg.sender_id !== member.id) return;

          let translated: string | null = null;
          if (
            !msg.deleted_at &&
            msg.content &&
            msg.sender_language &&
            msg.sender_language !== currentUserLang
          ) {
            const result = await translateSingleMessage(
              msg.id,
              msg.content,
              msg.sender_language
            );
            translated = result.translated ?? null;
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id ? { ...m, ...msg, translated_content: translated } : m
            )
          );
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
    // 글이나 첨부 둘 중 하나는 있어야 전송
    if ((!text && pending.length === 0) || sending || uploading) return;
    const attachments = pending;
    setInput("");
    setPending([]);
    setSending(true);
    // 전송 후에도 입력창에 포커스를 유지 → 연속 입력 시 다시 클릭할 필요 없음
    inputRef.current?.focus();

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: currentUserId,
      receiver_id: member.id,
      content: text,
      sender_language: currentUserLang,
      translated_content: null,
      is_read: false,
      created_at: new Date().toISOString(),
      attachments,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToBottom, 50);

    const result = await sendMessage(
      member.id,
      text,
      attachments.length > 0 ? attachments : null
    );
    setSending(false);
    if (result.error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }
    if (result.id) {
      // 임시 메시지를 실제 id로 교체 → 곧바로 수정/삭제 가능
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: result.id! } : m))
      );
    }
    // 봇에게 보낸 일반 텍스트면 응답 요청 (첨부만 보낸 경우는 제외)
    if (member.is_bot && text) {
      setBotTyping(true);
      setTimeout(scrollToBottom, 50);
      requestBotReply(member.id, text).finally(() => {
        setBotTyping(false);
      });
    }
  };

  // 첨부 파일 선택 → 업로드만 해두고 미리보기로 대기 (전송은 보내기 버튼으로)
  const handleAttach = async (files: File[]) => {
    if (uploading || sending) return;
    setUploading(true);
    const results = await Promise.all(
      files.map(async (file) => {
        const fd = new FormData();
        fd.append("file", file);
        return uploadChatAttachment(fd);
      })
    );
    setUploading(false);
    const ok: Attachment[] = [];
    for (const up of results) {
      if (up.error || !up.url || !up.type) {
        toast.error(up.error ?? "업로드 실패");
        continue;
      }
      ok.push({ url: up.url, type: up.type, name: up.name ?? "파일" });
    }
    if (ok.length > 0) setPending((prev) => [...prev, ...ok]);
    inputRef.current?.focus();
  };

  // 바탕화면/파일에서 끌어다 놓으면 첨부
  const { dragging, dropHandlers } = useFileDrop(
    handleAttach,
    uploading || sending || !!member.is_bot
  );

  // 내 메시지 수정 저장
  const handleSaveEdit = useCallback(async (msgId: string, value: string) => {
    setEditingId(null);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, content: value, edited_at: new Date().toISOString() }
          : m
      )
    );
    await editDirectMessage(msgId, value);
  }, []);

  // 내 메시지 삭제
  const handleDelete = useCallback(async (msgId: string) => {
    if (!(await confirmDialog({ message: "메시지를 삭제할까요?", danger: true }))) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              deleted_at: new Date().toISOString(),
              content: "",
              translated_content: null,
              attachment_url: null,
              attachments: [],
            }
          : m
      )
    );
    await deleteDirectMessage(msgId);
  }, []);

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
        const isDeleted = !!msg.deleted_at;
        const isEditing = editingId === msg.id;
        const atts = isDeleted ? [] : normalizeAttachments(msg);
        const hasAttachment = atts.length > 0;
        const hasTranslation = !!msg.translated_content && !isDeleted;
        const displayText = hasTranslation ? msg.translated_content! : msg.content;
        const isShowingOriginal = showOriginal.has(msg.id);

        // 같은 시간 + 같은 발신자의 연속 메시지면 마지막 것만 시간 표시
        const time = formatTime(msg.created_at);
        const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
        const showTime =
          !nextMsg ||
          nextMsg.sender_id !== msg.sender_id ||
          formatTime(nextMsg.created_at) !== time;

        // 내 메시지 + 삭제 안 됨 + 임시(temp) 아님일 때만 수정/삭제 가능
        const canManage = isMine && !isDeleted && !msg.id.startsWith("temp-");

        return (
          <div
            key={msg.id}
            className={`flex ${isMine ? "justify-end" : "justify-start"} ${showTime || hasTranslation ? "mb-3" : "mb-1"}`}
          >
            <div className={`flex max-w-[75%] flex-col ${isMine ? "items-end" : "items-start"}`}>
              {isEditing ? (
                <EditBox
                  initialValue={msg.content}
                  onSave={(v) => handleSaveEdit(msg.id, v)}
                  onCancel={() => setEditingId(null)}
                />
              ) : isDeleted ? (
                <div className="rounded-2xl bg-gray-50 px-3 py-2 text-sm italic text-gray-400">
                  삭제된 메시지입니다
                </div>
              ) : (
                <div className="group flex items-center gap-1">
                  {canManage && (
                    <MessageActions
                      canEdit={!hasAttachment}
                      onEdit={() => setEditingId(msg.id)}
                      onDelete={() => handleDelete(msg.id)}
                    />
                  )}
                  <div className="flex flex-col gap-1">
                    {hasAttachment && (
                      <AttachmentList attachments={atts} isMine={isMine} />
                    )}
                    {displayText && (
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
                    )}
                  </div>
                </div>
              )}
              {!isDeleted && (showTime || hasTranslation || msg.edited_at) && (
                <div className="flex items-center gap-1.5">
                  {showTime && (
                    <span className="mt-0.5 text-[10px] text-gray-300">
                      {time}
                    </span>
                  )}
                  {hasTranslation && (
                    <span className="mt-0.5 text-[10px] text-blue-300">{t("dm.translated")}</span>
                  )}
                  {msg.edited_at && (
                    <span className="mt-0.5 text-[10px] text-gray-300">수정됨</span>
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
    [
      messages,
      showOriginal,
      editingId,
      currentUserId,
      member.is_bot,
      t,
      handleContextMenu,
      toggleOriginal,
      handleSaveEdit,
      handleDelete,
    ]
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
      {...dropHandlers}
    >
      {!member.is_bot && <DropOverlay visible={dragging} />}
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
        {/* 첨부 미리보기 (전송 전 대기) */}
        <PendingAttachments
          items={pending}
          size="sm"
          onRemove={(i) => setPending((prev) => prev.filter((_, idx) => idx !== i))}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          {!member.is_bot && (
            <AttachmentButton onPicked={handleAttach} disabled={uploading || sending} />
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            // 한글 등 IME 조합 중 Enter는 조합 확정용 → 폼 전송 막아 마지막 글자 중복 방지
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.nativeEvent.isComposing) e.preventDefault();
            }}
            placeholder={
              uploading
                ? "업로드 중..."
                : member.is_bot
                  ? t("dm.askSean")
                  : t("dm.typeMessage")
            }
            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={(!input.trim() && pending.length === 0) || sending || uploading}
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
