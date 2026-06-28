"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Avatar from "@/components/avatar";
import {
  getGroupDmMessages,
  sendGroupDmMessage,
  markGroupDmAsRead,
  translateSingleGroupMessage,
} from "@/app/(dashboard)/group-dm/actions";
import {
  editGroupMessage,
  deleteGroupMessage,
  uploadChatAttachment,
} from "@/app/(dashboard)/chat-message-actions";
import { createClient } from "@/lib/supabase/client";
import { LANGUAGES } from "@/lib/languages";
import { useT } from "@/lib/i18n";
import { setChatActive } from "@/lib/active-chat";
import {
  AttachmentView,
  AttachmentButton,
  MessageActions,
  EditBox,
  type AttachmentType,
} from "@/components/chat/message-extras";

interface GroupMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  sender_language?: string | null;
  sender_name: string;
  sender_avatar_url: string | null;
  translated_content?: string | null;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  attachment_url?: string | null;
  attachment_type?: AttachmentType | null;
  attachment_name?: string | null;
}

interface RoomMember {
  id: string;
  name: string;
  avatar_url: string | null;
  presence?: string | null;
  language?: string | null;
}

interface GroupDmRoom {
  id: string;
  name: string;
  memberCount: number;
  members: RoomMember[];
}

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

const MIN_W = 320;
const MAX_W = 560;
const MIN_H = 360;
const MAX_H = 680;

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function GroupDmChat({
  room,
  currentUserId,
  currentUserLang,
  onClose,
  onMinimize,
  isMinimized,
  style,
}: {
  room: GroupDmRoom;
  currentUserId: string;
  currentUserLang: string;
  onClose: () => void;
  onMinimize: () => void;
  isMinimized: boolean;
  style?: React.CSSProperties;
}) {
  const t = useT();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState({ w: 360, h: 480 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string } | null>(null);
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const [showMembers, setShowMembers] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resizingRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const ASPECT = 480 / 360;

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
    getGroupDmMessages(room.id).then((data) => {
      setMessages(data as GroupMessage[]);
      setLoading(false);
      setTimeout(scrollToBottom, 50);
    });
    markGroupDmAsRead(room.id);
  }, [room.id, scrollToBottom]);

  // Realtime 구독
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group-dm-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_dm_messages",
          filter: `room_id=eq.${room.id}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (payload: any) => {
          const msg = payload.new as {
            id: string;
            room_id: string;
            sender_id: string;
            content: string;
            sender_language: string;
            created_at: string;
          };

          // 내가 보낸 메시지 → 낙관적 업데이트 교체
          if (msg.sender_id === currentUserId) {
            setMessages((prev) => {
              const tempIdx = prev.findIndex((m) => m.id.startsWith("temp-") && m.content === msg.content);
              if (tempIdx !== -1) {
                const next = [...prev];
                next[tempIdx] = {
                  ...msg,
                  sender_name: prev[tempIdx].sender_name,
                  sender_avatar_url: prev[tempIdx].sender_avatar_url,
                  translated_content: null,
                };
                return next;
              }
              return prev;
            });
            return;
          }

          // 다른 멤버 메시지
          const sender = room.members.find((m) => m.id === msg.sender_id);
          let translatedContent: string | null = null;

          if (msg.sender_language && msg.sender_language !== currentUserLang) {
            const result = await translateSingleGroupMessage(
              msg.id,
              msg.content,
              msg.sender_language
            );
            translatedContent = result.translated ?? null;
          }

          const newMsg: GroupMessage = {
            ...msg,
            sender_name: sender?.name ?? "알 수 없음",
            sender_avatar_url: sender?.avatar_url ?? null,
            translated_content: translatedContent,
          };

          setMessages((prev) => [...prev, newMsg]);
          setTimeout(scrollToBottom, 50);
          markGroupDmAsRead(room.id);
        }
      )
      // 멤버가 메시지를 수정/삭제하면 반영
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "group_dm_messages",
          filter: `room_id=eq.${room.id}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (payload: any) => {
          const msg = payload.new as GroupMessage;
          if (msg.sender_id === currentUserId) {
            // 내 수정/삭제는 낙관적 반영됨 → id 기준 병합만
            setMessages((prev) =>
              prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m))
            );
            return;
          }

          let translated: string | null = null;
          if (
            !msg.deleted_at &&
            msg.content &&
            msg.sender_language &&
            msg.sender_language !== currentUserLang
          ) {
            const result = await translateSingleGroupMessage(
              msg.id,
              msg.content,
              msg.sender_language
            );
            translated = result.translated ?? null;
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id
                ? { ...m, ...msg, translated_content: translated }
                : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, room.members, currentUserId, currentUserLang, scrollToBottom]);

  // 포커스 시 읽음 처리
  useEffect(() => {
    if (!isMinimized) {
      markGroupDmAsRead(room.id);
      inputRef.current?.focus();
    }
  }, [isMinimized, room.id]);

  // "보는 중" 등록 → 전역 알림 훅이 이 대화엔 소리 중복을 내지 않음
  useEffect(() => {
    const key = `group-${room.id}`;
    setChatActive(key, !isMinimized);
    return () => setChatActive(key, false);
  }, [room.id, isMinimized]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    // 내 프로필 정보
    const myProfile = room.members.find((m) => m.id === currentUserId);

    const optimistic: GroupMessage = {
      id: `temp-${Date.now()}`,
      room_id: room.id,
      sender_id: currentUserId,
      content: text,
      sender_language: currentUserLang,
      sender_name: myProfile?.name ?? "",
      sender_avatar_url: myProfile?.avatar_url ?? null,
      translated_content: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToBottom, 50);

    const result = await sendGroupDmMessage(room.id, text);
    setSending(false);
    if (result.error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  };

  // 첨부 파일 선택 → 업로드 후 메시지로 전송
  const handleAttach = async (file: File) => {
    if (uploading || sending) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const up = await uploadChatAttachment(fd);
    if (up.error || !up.url) {
      setUploading(false);
      alert(up.error ?? "업로드 실패");
      return;
    }

    const myProfile = room.members.find((m) => m.id === currentUserId);
    const optimistic: GroupMessage = {
      id: `temp-${Date.now()}`,
      room_id: room.id,
      sender_id: currentUserId,
      content: "",
      sender_language: currentUserLang,
      sender_name: myProfile?.name ?? "",
      sender_avatar_url: myProfile?.avatar_url ?? null,
      translated_content: null,
      created_at: new Date().toISOString(),
      attachment_url: up.url,
      attachment_type: up.type,
      attachment_name: up.name,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToBottom, 50);

    const result = await sendGroupDmMessage(room.id, "", {
      url: up.url,
      type: up.type!,
      name: up.name!,
    });
    setUploading(false);
    if (result.error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  };

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
    await editGroupMessage(msgId, value);
  }, []);

  // 내 메시지 삭제
  const handleDelete = useCallback(async (msgId: string) => {
    if (!confirm("메시지를 삭제할까요?")) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              deleted_at: new Date().toISOString(),
              content: "",
              translated_content: null,
              attachment_url: null,
            }
          : m
      )
    );
    await deleteGroupMessage(msgId);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, msg: GroupMessage) => {
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

  // 다국어 여부
  const hasMultiLang = room.members.some(
    (m) => m.language && m.language !== currentUserLang
  );

  // 메시지 리스트는 messages/showOriginal 변경 시에만 재계산
  // (입력창 타이핑 등 다른 state 변경 시 버블 전체 재렌더 방지)
  const messageList = useMemo(
    () =>
      messages.map((msg, idx) => {
        const isMine = msg.sender_id === currentUserId;
        const isDeleted = !!msg.deleted_at;
        const hasAttachment = !!msg.attachment_url && !isDeleted;
        const hasTranslation = !!msg.translated_content && !isDeleted;
        const displayText = hasTranslation ? msg.translated_content! : msg.content;
        const isShowingOriginal = showOriginal.has(msg.id);
        const canManage = isMine && !isDeleted && !msg.id.startsWith("temp-");

        // 이전 메시지와 같은 발신자면 이름/아바타 숨김
        const prevMsg = idx > 0 ? messages[idx - 1] : null;
        const showSenderInfo = !isMine && (!prevMsg || prevMsg.sender_id !== msg.sender_id);
        const offset = !isMine && !showSenderInfo ? "ml-[26px]" : "";

        // 같은 시간 + 같은 발신자의 연속 메시지면 마지막 것만 시간 표시
        const time = formatTime(msg.created_at);
        const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
        const showTime =
          !nextMsg ||
          nextMsg.sender_id !== msg.sender_id ||
          formatTime(nextMsg.created_at) !== time;

        return (
          <div key={msg.id} className={showTime || hasTranslation ? "mb-3" : "mb-1"}>
            {/* 발신자 정보 (그룹에서만) */}
            {showSenderInfo && (
              <div className="mb-1 flex items-center gap-1.5">
                <Avatar url={msg.sender_avatar_url} name={msg.sender_name} size={20} />
                <span className="text-[11px] font-medium text-gray-500">
                  {msg.sender_name}
                </span>
              </div>
            )}
            <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[75%] flex-col ${isMine ? "items-end" : "items-start"}`}>
                {editingId === msg.id ? (
                  <EditBox
                    initialValue={msg.content}
                    onSave={(v) => handleSaveEdit(msg.id, v)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : isDeleted ? (
                  <div className={`rounded-2xl bg-gray-50 px-3 py-2 text-sm italic text-gray-400 ${offset}`}>
                    삭제된 메시지입니다
                  </div>
                ) : (
                  <div className={`group flex items-center gap-1 ${offset}`}>
                    {canManage && (
                      <MessageActions
                        canEdit={!hasAttachment}
                        onEdit={() => setEditingId(msg.id)}
                        onDelete={() => handleDelete(msg.id)}
                      />
                    )}
                    <div className="flex flex-col gap-1">
                      {hasAttachment && (
                        <AttachmentView
                          url={msg.attachment_url!}
                          type={msg.attachment_type ?? null}
                          name={msg.attachment_name ?? null}
                          isMine={isMine}
                        />
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
                          {displayText}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!isDeleted && (showTime || hasTranslation || msg.edited_at) && (
                  <div className={`flex items-center gap-1.5 ${offset}`}>
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
          </div>
        );
      }),
    [
      messages,
      showOriginal,
      editingId,
      currentUserId,
      t,
      handleContextMenu,
      toggleOriginal,
      handleSaveEdit,
      handleDelete,
    ]
  );

  if (isMinimized) {
    return (
      <button
        onClick={onMinimize}
        className="flex items-center gap-2 rounded-t-xl border border-b-0 border-gray-200 bg-white px-4 py-2.5 transition-colors hover:bg-gray-50"
        style={style}
      >
        {/* 겹친 아바타 */}
        <div className="flex -space-x-2">
          {room.members
            .filter((m) => m.id !== currentUserId)
            .slice(0, 3)
            .map((m) => (
              <div key={m.id} className="relative">
                <Avatar url={m.avatar_url} name={m.name} size={22} />
              </div>
            ))}
        </div>
        <span className="max-w-24 truncate text-sm font-medium text-gray-700">
          {room.name}
        </span>
        <span className="text-[10px] text-gray-600">{room.memberCount}</span>
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
          {/* 겹친 아바타 */}
          <div className="flex -space-x-1.5">
            {room.members
              .filter((m) => m.id !== currentUserId)
              .slice(0, 3)
              .map((m) => (
                <div key={m.id} className="rounded-full border-2 border-white">
                  <Avatar url={m.avatar_url} name={m.name} size={24} />
                </div>
              ))}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="max-w-32 truncate text-sm font-medium text-gray-900">
                {room.name}
              </span>
              <span className="flex h-4 items-center rounded-full bg-gray-100 px-1.5 text-[10px] font-medium text-gray-500">
                {room.memberCount}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
              {hasMultiLang && (
                <span className="flex items-center gap-0.5">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                  </svg>
                  {t("dm.autoTranslate")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* 멤버 보기 토글 */}
          <button
            onClick={() => setShowMembers(!showMembers)}
            className={`rounded p-1 transition-colors active:scale-[0.95] ${showMembers ? "bg-gray-100 text-gray-600" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </button>
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

      {/* 멤버 패널 */}
      {showMembers && (
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
          <div className="space-y-1.5">
            {room.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <div className="relative">
                  <Avatar url={m.avatar_url} name={m.name} size={20} />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${
                      m.presence === "online"
                        ? "bg-emerald-400"
                        : m.presence === "away"
                          ? "bg-yellow-400"
                          : "bg-gray-300"
                    }`}
                  />
                </div>
                <span className="text-xs text-gray-600">
                  {m.name}
                  {m.id === currentUserId && (
                    <span className="ml-1 text-gray-600">({t("groupDm.me")})</span>
                  )}
                </span>
                {m.language && m.language !== currentUserLang && (
                  <span className="text-[10px] text-gray-400">
                    {LANGUAGES.find((l) => l.code === m.language)?.flag}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 메시지 영역 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-600">
            {t("common.loading")}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <div className="flex -space-x-2">
              {room.members
                .filter((m) => m.id !== currentUserId)
                .slice(0, 4)
                .map((m) => (
                  <div key={m.id} className="rounded-full border-2 border-white">
                    <Avatar url={m.avatar_url} name={m.name} size={36} />
                  </div>
                ))}
            </div>
            <p className="text-xs text-gray-600">{t("groupDm.startChat")}</p>
          </div>
        ) : (
          messageList
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
          <AttachmentButton onPicked={handleAttach} disabled={uploading || sending} />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={uploading ? "업로드 중..." : t("dm.typeMessage")}
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
