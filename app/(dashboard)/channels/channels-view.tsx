"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Avatar from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import { LANGUAGES } from "@/lib/languages";
import { useT } from "@/lib/i18n";
import { useNotification } from "@/hooks/use-notification";
import {
  getChannelMessages,
  sendChannelMessage,
  markChannelAsRead,
  translateSingleChannelMessage,
  getChannelMembers,
  createChannel,
  getMyChannels,
} from "./actions";
import DeptManageModal from "./dept-manage-modal";

interface ChannelItem {
  id: string;
  name: string;
  departmentId: string;
  unreadCount: number;
}

interface DepartmentItem {
  id: string;
  name: string;
  color: string;
  channels: ChannelItem[];
}

interface CompanyMember {
  id: string;
  name: string;
  avatar_url: string | null;
  position: string | null;
}

interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  sender_language?: string | null;
  sender_name: string;
  sender_avatar_url: string | null;
  translated_content?: string | null;
  created_at: string;
}

interface ChannelMember {
  id: string;
  name: string;
  avatar_url: string | null;
  presence?: string | null;
  language?: string | null;
}

export default function ChannelsView({
  currentUserId,
  currentUserLang,
  isAdmin,
  initialDepartments,
  companyMembers,
}: {
  currentUserId: string;
  currentUserLang: string;
  isAdmin: boolean;
  initialDepartments: DepartmentItem[];
  companyMembers: CompanyMember[];
}) {
  const t = useT();
  const [departments, setDepartments] =
    useState<DepartmentItem[]>(initialDepartments);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    initialDepartments[0]?.channels[0]?.id ?? null
  );
  const [showManage, setShowManage] = useState(false);
  const [addingChannelDeptId, setAddingChannelDeptId] = useState<string | null>(
    null
  );
  const [newChannelName, setNewChannelName] = useState("");

  const refreshDepartments = useCallback(async () => {
    const data = await getMyChannels();
    setDepartments(data as DepartmentItem[]);
  }, []);

  const selectedChannel = departments
    .flatMap((d) => d.channels)
    .find((c) => c.id === selectedChannelId);
  const selectedDept = departments.find((d) =>
    d.channels.some((c) => c.id === selectedChannelId)
  );

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    // 안읽음 배지 즉시 0으로
    setDepartments((prev) =>
      prev.map((d) => ({
        ...d,
        channels: d.channels.map((c) =>
          c.id === channelId ? { ...c, unreadCount: 0 } : c
        ),
      }))
    );
  };

  const handleCreateChannel = async (deptId: string) => {
    const name = newChannelName.trim();
    if (!name) return;
    const result = await createChannel(deptId, name);
    setNewChannelName("");
    setAddingChannelDeptId(null);
    if (result.success) {
      await refreshDepartments();
      if (result.channelId) setSelectedChannelId(result.channelId);
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* 좌측 레일 */}
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-gray-50">
        <div className="flex h-12 items-center justify-between border-b border-gray-100 px-4">
          <span className="text-sm font-semibold text-gray-900">
            {t("nav.channels")}
          </span>
          {isAdmin && (
            <button
              onClick={() => setShowManage(true)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-blue-500 transition-colors hover:bg-blue-50"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {t("channels.manage")}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {departments.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-gray-600">
              {isAdmin ? t("channels.emptyAdmin") : t("channels.empty")}
            </div>
          ) : (
            departments.map((dept) => (
              <div key={dept.id} className="mb-4">
                <div className="mb-1 flex items-center gap-2 px-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: dept.color }}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {dept.name}
                  </span>
                </div>
                {dept.channels.map((channel) => {
                  const isActive = channel.id === selectedChannelId;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => handleSelectChannel(channel.id)}
                      className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        isActive
                          ? "bg-blue-50 font-medium text-blue-500"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="text-gray-400">#</span>
                        {channel.name}
                      </span>
                      {channel.unreadCount > 0 && !isActive && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-medium text-white">
                          {channel.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* 채널 추가 */}
                {addingChannelDeptId === dept.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleCreateChannel(dept.id);
                    }}
                    className="mt-1 px-2"
                  >
                    <input
                      autoFocus
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      onBlur={() => {
                        setAddingChannelDeptId(null);
                        setNewChannelName("");
                      }}
                      placeholder={t("channels.channelNamePlaceholder")}
                      className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none"
                    />
                  </form>
                ) : (
                  <button
                    onClick={() => setAddingChannelDeptId(dept.id)}
                    className="mt-0.5 flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    {t("channels.addChannel")}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* 우측 채팅 */}
      <div className="flex flex-1 flex-col">
        {selectedChannel && selectedDept ? (
          <ChannelChat
            key={selectedChannel.id}
            channelId={selectedChannel.id}
            channelName={selectedChannel.name}
            deptName={selectedDept.name}
            currentUserId={currentUserId}
            currentUserLang={currentUserLang}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-600">
            {t("channels.selectChannel")}
          </div>
        )}
      </div>

      {showManage && (
        <DeptManageModal
          companyMembers={companyMembers}
          onClose={() => setShowManage(false)}
          onChanged={refreshDepartments}
        />
      )}
    </div>
  );
}

// ===== 채널 채팅 패널 (풀페이지) =====

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function ChannelChat({
  channelId,
  channelName,
  deptName,
  currentUserId,
  currentUserLang,
}: {
  channelId: string;
  channelName: string;
  deptName: string;
  currentUserId: string;
  currentUserLang: string;
}) {
  const t = useT();
  const { notify } = useNotification();
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // 초기 로드 (채널 변경 시 key로 재마운트되므로 loading 초기값 true 사용)
  useEffect(() => {
    getChannelMessages(channelId).then((data) => {
      setMessages(data as ChannelMessage[]);
      setLoading(false);
      setTimeout(scrollToBottom, 50);
    });
    getChannelMembers(channelId).then((data) =>
      setMembers(data as ChannelMember[])
    );
    markChannelAsRead(channelId);
    inputRef.current?.focus();
  }, [channelId, scrollToBottom]);

  // Realtime 구독
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dept-channel-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dept_channel_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (payload: any) => {
          const msg = payload.new as {
            id: string;
            channel_id: string;
            sender_id: string;
            content: string;
            sender_language: string;
            created_at: string;
          };

          // 내가 보낸 메시지 → 낙관적 업데이트 교체
          if (msg.sender_id === currentUserId) {
            setMessages((prev) => {
              const tempIdx = prev.findIndex(
                (m) => m.id.startsWith("temp-") && m.content === msg.content
              );
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

          const sender = members.find((m) => m.id === msg.sender_id);
          let translatedContent: string | null = null;
          if (msg.sender_language && msg.sender_language !== currentUserLang) {
            const result = await translateSingleChannelMessage(
              msg.id,
              msg.content,
              msg.sender_language
            );
            translatedContent = result.translated ?? null;
          }

          const newMsg: ChannelMessage = {
            ...msg,
            sender_name: sender?.name ?? "알 수 없음",
            sender_avatar_url: sender?.avatar_url ?? null,
            translated_content: translatedContent,
          };

          setMessages((prev) => [...prev, newMsg]);
          notify(`#${channelName} · ${newMsg.sender_name}`, newMsg.content);
          setTimeout(scrollToBottom, 50);
          markChannelAsRead(channelId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    channelId,
    channelName,
    members,
    currentUserId,
    currentUserLang,
    notify,
    scrollToBottom,
  ]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const me = members.find((m) => m.id === currentUserId);
    const optimistic: ChannelMessage = {
      id: `temp-${Date.now()}`,
      channel_id: channelId,
      sender_id: currentUserId,
      content: text,
      sender_language: currentUserLang,
      sender_name: me?.name ?? "",
      sender_avatar_url: me?.avatar_url ?? null,
      translated_content: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToBottom, 50);

    const result = await sendChannelMessage(channelId, text);
    setSending(false);
    if (result.error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  };

  const toggleOriginal = useCallback((msgId: string) => {
    setShowOriginal((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const hasMultiLang = members.some(
    (m) => m.language && m.language !== currentUserLang
  );

  // 메시지 리스트는 messages/showOriginal 변경 시에만 재계산
  // (입력창 타이핑 등 다른 state 변경 시 버블 전체 재렌더 방지)
  const messageList = useMemo(
    () =>
      messages.map((msg, idx) => {
        const isMine = msg.sender_id === currentUserId;
        const hasTranslation = !!msg.translated_content;
        const displayText = hasTranslation
          ? msg.translated_content!
          : msg.content;
        const isShowingOriginal = showOriginal.has(msg.id);

        const prevMsg = idx > 0 ? messages[idx - 1] : null;
        const showSenderInfo =
          !isMine && (!prevMsg || prevMsg.sender_id !== msg.sender_id);

        const time = formatTime(msg.created_at);
        const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
        const showTime =
          !nextMsg ||
          nextMsg.sender_id !== msg.sender_id ||
          formatTime(nextMsg.created_at) !== time;
        const senderLang = LANGUAGES.find(
          (l) => l.code === msg.sender_language
        );

        return (
          <div
            key={msg.id}
            className={showTime || hasTranslation ? "mb-3" : "mb-1"}
          >
            {showSenderInfo && (
              <div className="mb-1 flex items-center gap-1.5">
                <Avatar
                  url={msg.sender_avatar_url}
                  name={msg.sender_name}
                  size={20}
                />
                <span className="text-[11px] font-medium text-gray-500">
                  {msg.sender_name}
                </span>
              </div>
            )}
            <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`flex max-w-[70%] flex-col ${
                  isMine ? "items-end" : "items-start"
                }`}
              >
                <div
                  onClick={() =>
                    hasTranslation && toggleOriginal(msg.id)
                  }
                  className={`select-text rounded-2xl px-3.5 py-2 text-sm ${
                    isMine
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-900"
                  } ${hasTranslation ? "cursor-pointer" : ""} ${
                    !isMine && !showSenderInfo ? "ml-[26px]" : ""
                  }`}
                >
                  {displayText}
                </div>
                {(showTime || hasTranslation) && (
                  <div
                    className={`flex items-center gap-1.5 ${
                      !isMine && !showSenderInfo ? "ml-[26px]" : ""
                    }`}
                  >
                    {showTime && (
                      <span className="mt-0.5 text-[10px] text-gray-300">
                        {time}
                      </span>
                    )}
                    {hasTranslation && (
                      <span className="mt-0.5 text-[10px] text-blue-400">
                        {t("dm.translated")}
                      </span>
                    )}
                  </div>
                )}
                {isShowingOriginal && hasTranslation && (
                  <div className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div className="mb-1 text-[10px] text-gray-600">
                      {t("dm.original")}{" "}
                      {senderLang
                        ? `${senderLang.flag} ${senderLang.label}`
                        : ""}
                    </div>
                    <p className="text-xs text-gray-600">{msg.content}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }),
    [messages, showOriginal, currentUserId, t, toggleOriginal]
  );

  return (
    <>
      {/* 헤더 */}
      <div className="flex h-12 items-center justify-between border-b border-gray-100 px-5">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-gray-900">
            <span className="text-gray-400"># </span>
            {channelName}
          </span>
          <span className="text-xs text-gray-600">{deptName}</span>
          <span className="flex h-4 items-center rounded-full bg-gray-100 px-1.5 text-[10px] font-medium text-gray-500">
            {members.length}
          </span>
        </div>
        {hasMultiLang && (
          <span className="flex items-center gap-1 text-[11px] text-gray-600">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
              />
            </svg>
            {t("dm.autoTranslate")}
          </span>
        )}
      </div>

      {/* 메시지 영역 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-600">
            {t("common.loading")}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5">
            <span className="text-2xl text-gray-300">#</span>
            <p className="text-sm font-medium text-gray-500">
              #{channelName}
            </p>
            <p className="text-xs text-gray-600">{t("channels.startChat")}</p>
          </div>
        ) : (
          messageList
        )}
      </div>

      {/* 입력 영역 */}
      <div className="border-t border-gray-100 px-4 py-3">
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
            placeholder={`#${channelName} · ${t("channels.messagePlaceholder")}`}
            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white transition-all duration-200 ease-spring shadow-soft-sm hover:bg-blue-600 hover:shadow-brand active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
