"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Avatar from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import { ComposeLinkPreview } from "@/components/compose-link-preview";
import { MessageLinkPreviews } from "@/components/link-preview-card";
import { LANGUAGES } from "@/lib/languages";
import { useT } from "@/lib/i18n";
import { setChatActive } from "@/lib/active-chat";
import {
  getChannelMessages,
  sendChannelMessage,
  markChannelAsRead,
  translateSingleChannelMessage,
  getChannelMembers,
  createChannel,
  deleteChannel,
  getMyChannels,
  getThreadReplies,
} from "./actions";
import {
  MemberTrigger,
  MemberProfilePanel,
  MembersListPanel,
  type ChatMember,
} from "@/components/chat/member-profile";
import {
  editChannelMessage,
  deleteChannelMessage,
  uploadChatAttachment,
} from "@/app/(dashboard)/chat-message-actions";
import {
  AttachmentList,
  AttachmentButton,
  PendingAttachments,
  DropOverlay,
  useFileDrop,
  normalizeAttachments,
  MessageActions,
  MessageContent,
  EditBox,
  type AttachmentType,
  type Attachment,
} from "@/components/chat/message-extras";
import {
  RichComposer,
  type RichComposerHandle,
} from "@/components/chat/rich-composer";
import DeptManageModal from "./dept-manage-modal";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";

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
  edited_at?: string | null;
  deleted_at?: string | null;
  attachment_url?: string | null;
  attachment_type?: AttachmentType | null;
  attachment_name?: string | null;
  attachments?: Attachment[] | null;
  thread_root_id?: string | null;
  reply_count?: number;
  last_reply_at?: string | null;
  message_type?: string | null;
}

interface ChannelMember {
  id: string;
  name: string;
  avatar_url: string | null;
  presence?: string | null;
  language?: string | null;
  position?: string | null;
  role?: string | null;
  email?: string | null;
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
  const searchParams = useSearchParams();
  const [departments, setDepartments] =
    useState<DepartmentItem[]>(initialDepartments);
  // ?channel=<id> (멘션 알림 클릭 등)로 들어오면 해당 채널을 먼저 선택
  const allChannelIds = initialDepartments.flatMap((d) =>
    d.channels.map((c) => c.id)
  );
  const channelParam = searchParams.get("channel");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    (channelParam && allChannelIds.includes(channelParam) ? channelParam : null) ??
      initialDepartments[0]?.channels[0]?.id ??
      null
  );
  const [showManage, setShowManage] = useState(false);
  const [addingChannelDeptId, setAddingChannelDeptId] = useState<string | null>(
    null
  );
  const [newChannelName, setNewChannelName] = useState("");

  // 채널 페이지에 이미 있는 상태에서 ?channel= 링크로 다시 들어오면 선택 갱신
  useEffect(() => {
    if (channelParam && allChannelIds.includes(channelParam)) {
      setSelectedChannelId(channelParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelParam]);

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

  const handleDeleteChannel = async (channelId: string, name: string) => {
    if (
      !(await confirmDialog({
        message: `#${name} 채널을 삭제할까요?\n채널의 모든 메시지가 함께 사라지며 되돌릴 수 없어요.`,
        danger: true,
      }))
    )
      return;
    const result = await deleteChannel(channelId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    if (selectedChannelId === channelId) setSelectedChannelId(null);
    await refreshDepartments();
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
                    <div key={channel.id} className="group relative mb-0.5">
                      <button
                        onClick={() => handleSelectChannel(channel.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors ${
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
                          <span
                            className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-medium text-white ${
                              isAdmin ? "group-hover:hidden" : ""
                            }`}
                          >
                            {channel.unreadCount}
                          </span>
                        )}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChannel(channel.id, channel.name);
                          }}
                          title="채널 삭제"
                          className="absolute right-1.5 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:flex"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
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

function dayKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateDivider(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${
    days[d.getDay()]
  })`;
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
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  // 우측 보조 패널: 멤버 목록 / 개별 프로필 (스레드 패널과 상호 배타)
  const [sidePanel, setSidePanel] = useState<
    { kind: "members" } | { kind: "profile"; userId: string } | null
  >(null);
  const [composerHasText, setComposerHasText] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<RichComposerHandle>(null);

  // ===== 스레드(답글) 상태 =====
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [threadReplies, setThreadReplies] = useState<ChannelMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadHasText, setThreadHasText] = useState(false);
  const [threadText, setThreadText] = useState("");
  const [threadSending, setThreadSending] = useState(false);
  const [threadUploading, setThreadUploading] = useState(false);
  const [threadEditingId, setThreadEditingId] = useState<string | null>(null);
  const [threadPending, setThreadPending] = useState<Attachment[]>([]);
  // 실시간 핸들러가 재구독 없이 현재 열린 스레드를 참조하도록 ref로 동기화
  const threadRootIdRef = useRef<string | null>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const threadComposerRef = useRef<RichComposerHandle>(null);

  useEffect(() => {
    threadRootIdRef.current = threadRootId;
  }, [threadRootId]);

  const threadRoot = threadRootId
    ? messages.find((m) => m.id === threadRootId) ?? null
    : null;

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
    composerRef.current?.focus();
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
            thread_root_id: string | null;
            message_type?: string | null;
          };

          // ── 시스템 메시지(멤버 입장 등) ───────────────────
          if (msg.message_type && msg.message_type !== "message") {
            // 새 입장자가 members에 없을 수 있어 목록을 새로 받아 이름/아바타 확보
            const fresh = (await getChannelMembers(
              channelId
            )) as ChannelMember[];
            setMembers(fresh);
            const joiner = fresh.find((m) => m.id === msg.sender_id);
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id)
                ? prev
                : [
                    ...prev,
                    {
                      ...msg,
                      sender_name: joiner?.name ?? "새 멤버",
                      sender_avatar_url: joiner?.avatar_url ?? null,
                      translated_content: null,
                    },
                  ]
            );
            setTimeout(scrollToBottom, 50);
            return;
          }

          // ── 스레드 답글 처리 ──────────────────────────────
          if (msg.thread_root_id) {
            const rootId = msg.thread_root_id;
            // 내 답글은 낙관적으로 이미 반영됨 → 무시 (중복 카운트 방지)
            if (msg.sender_id === currentUserId) return;

            // 본문 리스트의 루트 메시지 답글 수 갱신
            setMessages((prev) =>
              prev.map((m) =>
                m.id === rootId
                  ? {
                      ...m,
                      reply_count: (m.reply_count ?? 0) + 1,
                      last_reply_at: msg.created_at,
                    }
                  : m
              )
            );

            // 현재 열려있는 스레드면 답글 목록에 추가
            if (threadRootIdRef.current === rootId) {
              const sender = members.find((m) => m.id === msg.sender_id);
              let translated: string | null = null;
              if (
                msg.sender_language &&
                msg.sender_language !== currentUserLang
              ) {
                const result = await translateSingleChannelMessage(
                  msg.id,
                  msg.content,
                  msg.sender_language
                );
                translated = result.translated ?? null;
              }
              setThreadReplies((prev) => [
                ...prev,
                {
                  ...msg,
                  sender_name: sender?.name ?? "알 수 없음",
                  sender_avatar_url: sender?.avatar_url ?? null,
                  translated_content: translated,
                },
              ]);
            }
            return;
          }

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
          setTimeout(scrollToBottom, 50);
          markChannelAsRead(channelId);
        }
      )
      // 멤버가 메시지를 수정/삭제하면 반영
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dept_channel_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (payload: any) => {
          const msg = payload.new as ChannelMessage;

          // ── 스레드 답글 수정/삭제 반영 ──────────────────────
          if (msg.thread_root_id) {
            if (threadRootIdRef.current !== msg.thread_root_id) return;
            let translated: string | null = null;
            if (
              !msg.deleted_at &&
              msg.content &&
              msg.sender_id !== currentUserId &&
              msg.sender_language &&
              msg.sender_language !== currentUserLang
            ) {
              const result = await translateSingleChannelMessage(
                msg.id,
                msg.content,
                msg.sender_language
              );
              translated = result.translated ?? null;
            }
            setThreadReplies((prev) =>
              prev.map((r) =>
                r.id === msg.id
                  ? { ...r, ...msg, translated_content: translated }
                  : r
              )
            );
            return;
          }

          if (msg.sender_id === currentUserId) {
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
            const result = await translateSingleChannelMessage(
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
  }, [
    channelId,
    channelName,
    members,
    currentUserId,
    currentUserLang,
    scrollToBottom,
  ]);

  // "보는 중" 등록 → 전역 알림 훅이 이 채널엔 소리 중복을 내지 않음
  useEffect(() => {
    const key = `channel-${channelId}`;
    setChatActive(key, true);
    return () => setChatActive(key, false);
  }, [channelId]);

  const handleSend = async () => {
    const text = (composerRef.current?.getText() ?? "").trim();
    // 글이나 첨부 둘 중 하나는 있어야 전송
    if ((!text && pending.length === 0) || sending || uploading) return;
    const attachments = pending;
    composerRef.current?.clear();
    setComposerHasText(false);
    setPending([]);
    setSending(true);
    // 전송 후에도 입력창에 포커스를 유지 → 연속 입력 시 다시 클릭할 필요 없음
    composerRef.current?.focus();

    const me = members.find((m) => m.id === currentUserId);
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChannelMessage = {
      id: tempId,
      channel_id: channelId,
      sender_id: currentUserId,
      content: text,
      sender_language: currentUserLang,
      sender_name: me?.name ?? "",
      sender_avatar_url: me?.avatar_url ?? null,
      translated_content: null,
      created_at: new Date().toISOString(),
      attachments,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToBottom, 50);

    const result = await sendChannelMessage(
      channelId,
      text,
      attachments.length > 0 ? attachments : null
    );
    setSending(false);
    // 전송 중 비활성화로 풀렸던 포커스를 다시 입력창으로 복귀
    setTimeout(() => composerRef.current?.focus(), 0);
    if (result.error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } else if (result.id) {
      // 임시 메시지를 실제 id로 교체 → 곧바로 수정/삭제 가능
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: result.id! } : m))
      );
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
    composerRef.current?.focus();
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
    await editChannelMessage(msgId, value);
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
    await deleteChannelMessage(msgId);
  }, []);

  // ===== 스레드(답글) 핸들러 =====
  const threadScrollToBottom = useCallback(() => {
    if (threadScrollRef.current) {
      threadScrollRef.current.scrollTop = threadScrollRef.current.scrollHeight;
    }
  }, []);

  // 멤버 정보 빠른 조회 (호버 카드 / 프로필 패널용)
  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  // 우측 프로필/멤버 패널 열기 → 스레드 패널과 상호 배타
  const openProfile = useCallback((userId: string) => {
    setThreadRootId(null);
    setSidePanel({ kind: "profile", userId });
  }, []);

  const openMembers = useCallback(() => {
    setThreadRootId(null);
    setSidePanel((prev) => (prev?.kind === "members" ? null : { kind: "members" }));
  }, []);

  const openThread = useCallback(
    async (rootId: string) => {
      setSidePanel(null);
      setThreadRootId(rootId);
      setThreadReplies([]);
      threadComposerRef.current?.clear();
      setThreadHasText(false);
      setThreadPending([]);
      setThreadEditingId(null);
      setThreadLoading(true);
      const { replies } = await getThreadReplies(rootId);
      setThreadReplies(replies as ChannelMessage[]);
      setThreadLoading(false);
      setTimeout(() => {
        threadScrollToBottom();
        threadComposerRef.current?.focus();
      }, 50);
    },
    [threadScrollToBottom]
  );

  const closeThread = useCallback(() => {
    setThreadRootId(null);
    setThreadReplies([]);
    setThreadPending([]);
    setThreadEditingId(null);
  }, []);

  const handleThreadSend = async () => {
    if (!threadRootId) return;
    const text = (threadComposerRef.current?.getText() ?? "").trim();
    if ((!text && threadPending.length === 0) || threadSending || threadUploading)
      return;
    const attachments = threadPending;
    const rootId = threadRootId;
    threadComposerRef.current?.clear();
    setThreadHasText(false);
    setThreadPending([]);
    setThreadSending(true);
    // 전송 후에도 답글 입력창에 포커스를 유지
    threadComposerRef.current?.focus();

    const me = members.find((m) => m.id === currentUserId);
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChannelMessage = {
      id: tempId,
      channel_id: channelId,
      sender_id: currentUserId,
      content: text,
      sender_language: currentUserLang,
      sender_name: me?.name ?? "",
      sender_avatar_url: me?.avatar_url ?? null,
      translated_content: null,
      created_at: new Date().toISOString(),
      thread_root_id: rootId,
      attachments,
    };
    setThreadReplies((prev) => [...prev, optimistic]);
    // 본문 루트의 답글 수 낙관적 증가
    setMessages((prev) =>
      prev.map((m) =>
        m.id === rootId
          ? {
              ...m,
              reply_count: (m.reply_count ?? 0) + 1,
              last_reply_at: optimistic.created_at,
            }
          : m
      )
    );
    setTimeout(threadScrollToBottom, 50);

    const result = await sendChannelMessage(
      channelId,
      text,
      attachments.length > 0 ? attachments : null,
      rootId
    );
    setThreadSending(false);
    // 전송 중 비활성화로 풀렸던 포커스를 다시 답글 입력창으로 복귀
    setTimeout(() => threadComposerRef.current?.focus(), 0);
    if (result.error) {
      setThreadReplies((prev) => prev.filter((m) => m.id !== tempId));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === rootId
            ? { ...m, reply_count: Math.max(0, (m.reply_count ?? 1) - 1) }
            : m
        )
      );
    } else if (result.id) {
      setThreadReplies((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: result.id! } : m))
      );
    }
  };

  const handleThreadAttach = async (files: File[]) => {
    if (threadUploading || threadSending) return;
    setThreadUploading(true);
    const results = await Promise.all(
      files.map(async (file) => {
        const fd = new FormData();
        fd.append("file", file);
        return uploadChatAttachment(fd);
      })
    );
    setThreadUploading(false);
    const ok: Attachment[] = [];
    for (const up of results) {
      if (up.error || !up.url || !up.type) {
        toast.error(up.error ?? "업로드 실패");
        continue;
      }
      ok.push({ url: up.url, type: up.type, name: up.name ?? "파일" });
    }
    if (ok.length > 0) setThreadPending((prev) => [...prev, ...ok]);
    threadComposerRef.current?.focus();
  };

  // 바탕화면/파일에서 끌어다 놓으면 첨부 (본문 / 스레드 각각)
  const { dragging, dropHandlers } = useFileDrop(
    handleAttach,
    uploading || sending
  );
  const { dragging: threadDragging, dropHandlers: threadDropHandlers } =
    useFileDrop(handleThreadAttach, threadUploading || threadSending);

  // 스레드 패널이 열리면 답글 입력창에 자동 포커스 (렌더 후)
  useEffect(() => {
    if (!threadRootId) return;
    const id = setTimeout(() => threadComposerRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [threadRootId]);

  const handleThreadSaveEdit = useCallback(
    async (msgId: string, value: string) => {
      setThreadEditingId(null);
      setThreadReplies((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, content: value, edited_at: new Date().toISOString() }
            : m
        )
      );
      await editChannelMessage(msgId, value);
    },
    []
  );

  const handleThreadDelete = useCallback(async (msgId: string) => {
    if (!(await confirmDialog({ message: "답글을 삭제할까요?", danger: true }))) return;
    setThreadReplies((prev) =>
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
    await deleteChannelMessage(msgId);
  }, []);

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
        // 시스템 메시지(멤버 입장 등) → 가운데 안내 라인 (그룹화/액션 없음)
        if (msg.message_type && msg.message_type !== "message") {
          const prev = idx > 0 ? messages[idx - 1] : null;
          const showDivider =
            !prev || dayKey(prev.created_at) !== dayKey(msg.created_at);
          return (
            <div key={msg.id}>
              {showDivider && (
                <div className="my-3 flex items-center gap-3 px-2">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="rounded-full border border-gray-200 bg-white px-3 py-0.5 text-[11px] font-medium text-gray-500">
                    {formatDateDivider(msg.created_at)}
                  </span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
              )}
              <div className="my-1 flex items-center justify-center gap-1.5 px-2 py-0.5 text-[11px] text-gray-400">
                <svg className="h-3.5 w-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
                <span>
                  <span className="font-medium text-gray-500">
                    {msg.sender_name}
                  </span>
                  님이 채널에 들어왔어요
                </span>
              </div>
            </div>
          );
        }

        const isMine = msg.sender_id === currentUserId;
        const isDeleted = !!msg.deleted_at;
        const atts = isDeleted ? [] : normalizeAttachments(msg);
        const hasAttachment = atts.length > 0;
        const hasTranslation = !!msg.translated_content && !isDeleted;
        const displayText = hasTranslation
          ? msg.translated_content!
          : msg.content;
        const isShowingOriginal = showOriginal.has(msg.id);
        const canManage = isMine && !isDeleted && !msg.id.startsWith("temp-");

        const time = formatTime(msg.created_at);
        const senderLang = LANGUAGES.find((l) => l.code === msg.sender_language);

        const prevMsg = idx > 0 ? messages[idx - 1] : null;
        // 날짜가 바뀌면 구분선 표시
        const showDateDivider =
          !prevMsg || dayKey(prevMsg.created_at) !== dayKey(msg.created_at);
        // 슬랙식 그룹화: 보낸 사람이 바뀌거나 5분 이상 지나면 아바타+이름 헤더 표시
        const gapMs = prevMsg
          ? new Date(msg.created_at).getTime() -
            new Date(prevMsg.created_at).getTime()
          : Infinity;
        const showHeader =
          showDateDivider ||
          !prevMsg ||
          prevMsg.sender_id !== msg.sender_id ||
          gapMs > 5 * 60 * 1000;

        return (
          <div key={msg.id}>
            {showDateDivider && (
              <div className="my-3 flex items-center gap-3 px-2">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="rounded-full border border-gray-200 bg-white px-3 py-0.5 text-[11px] font-medium text-gray-500">
                  {formatDateDivider(msg.created_at)}
                </span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
            )}
            <div
              className={`group relative flex gap-2.5 rounded-md px-2 hover:bg-gray-50 ${
                showHeader ? "mt-2 py-1" : "py-0.5"
              }`}
            >
              {/* 좌측: 아바타(헤더) 또는 hover 시 시간 */}
              <div className="w-9 shrink-0">
                {showHeader ? (
                  <MemberTrigger
                    member={
                      memberMap.get(msg.sender_id) ?? {
                        id: msg.sender_id,
                        name: msg.sender_name,
                        avatar_url: msg.sender_avatar_url,
                      }
                    }
                    onOpen={openProfile}
                    className="rounded-full transition-opacity hover:opacity-80"
                  >
                    <Avatar
                      url={msg.sender_avatar_url}
                      name={msg.sender_name}
                      size={36}
                    />
                  </MemberTrigger>
                ) : (
                  <span className="mt-0.5 hidden text-right text-[10px] leading-5 text-gray-300 group-hover:block">
                    {time}
                  </span>
                )}
              </div>

              {/* 본문 */}
              <div className="min-w-0 flex-1">
                {showHeader && (
                  <div className="flex items-baseline gap-2">
                    <MemberTrigger
                      member={
                        memberMap.get(msg.sender_id) ?? {
                          id: msg.sender_id,
                          name: msg.sender_name,
                          avatar_url: msg.sender_avatar_url,
                        }
                      }
                      onOpen={openProfile}
                      className="text-sm font-semibold text-gray-900 hover:underline"
                    >
                      {msg.sender_name}
                    </MemberTrigger>
                    <span className="text-[11px] text-gray-400">{time}</span>
                  </div>
                )}

                {editingId === msg.id ? (
                  <div className="mt-1">
                    <EditBox
                      initialValue={msg.content}
                      onSave={(v) => handleSaveEdit(msg.id, v)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : isDeleted ? (
                  <p className="text-sm italic text-gray-400">
                    삭제된 메시지입니다
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {hasAttachment && (
                      <AttachmentList attachments={atts} isMine={isMine} />
                    )}
                    {displayText && (
                      <p
                        onClick={() => hasTranslation && toggleOriginal(msg.id)}
                        className={`select-text whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800 ${
                          hasTranslation ? "cursor-pointer" : ""
                        }`}
                      >
                        <MessageContent
                          text={displayText}
                          currentUserId={currentUserId}
                        />
                        {hasTranslation && (
                          <span className="ml-1.5 align-middle text-[10px] text-blue-400">
                            {t("dm.translated")}
                          </span>
                        )}
                        {msg.edited_at && (
                          <span className="ml-1.5 align-middle text-[10px] text-gray-300">
                            (수정됨)
                          </span>
                        )}
                      </p>
                    )}
                    {isShowingOriginal && hasTranslation && (
                      <div className="mt-0.5 rounded-lg border border-gray-200 bg-white px-3 py-2">
                        <div className="mb-1 text-[10px] text-gray-600">
                          {t("dm.original")}{" "}
                          {senderLang
                            ? `${senderLang.flag} ${senderLang.label}`
                            : ""}
                        </div>
                        <p className="text-xs text-gray-600">{msg.content}</p>
                      </div>
                    )}
                    <MessageLinkPreviews content={msg.content} />
                  </div>
                )}

                {/* 답글 수 칩 → 클릭 시 스레드 열기 */}
                {!isDeleted && (msg.reply_count ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => openThread(msg.id)}
                    className={`mt-1 flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                      threadRootId === msg.id
                        ? "border-blue-200 bg-blue-50 text-blue-600"
                        : "border-transparent text-blue-500 hover:border-gray-200 hover:bg-white"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                    {msg.reply_count}개의 답글
                    {msg.last_reply_at && (
                      <span className="font-normal text-gray-400">
                        · 마지막 답글 {formatTime(msg.last_reply_at)}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* 우측 hover 액션 (답글 + 본인 메시지 수정/삭제) */}
              {!isDeleted && !msg.id.startsWith("temp-") && (
                <div className="absolute right-2 top-0 flex -translate-y-1/2 items-center rounded-lg border border-gray-200 bg-white opacity-0 shadow-soft-sm transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openThread(msg.id)}
                    title="스레드로 답글"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                  </button>
                  {canManage && (
                    <MessageActions
                      canEdit={!hasAttachment}
                      onEdit={() => setEditingId(msg.id)}
                      onDelete={() => handleDelete(msg.id)}
                    />
                  )}
                </div>
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
      t,
      toggleOriginal,
      handleSaveEdit,
      handleDelete,
      openThread,
      threadRootId,
      openProfile,
      memberMap,
    ]
  );

  // 스레드 패널용 단일 메시지 렌더 (루트/답글 공용)
  const renderThreadRow = (msg: ChannelMessage, isRoot: boolean) => {
    const isMine = msg.sender_id === currentUserId;
    const isDeleted = !!msg.deleted_at;
    const atts = isDeleted ? [] : normalizeAttachments(msg);
    const hasAttachment = atts.length > 0;
    const hasTranslation = !!msg.translated_content && !isDeleted;
    const displayText = hasTranslation ? msg.translated_content! : msg.content;
    const isShowingOriginal = showOriginal.has(msg.id);
    const canManage = isMine && !isDeleted && !msg.id.startsWith("temp-");
    const editingId2 = isRoot ? editingId : threadEditingId;
    const onSave = isRoot ? handleSaveEdit : handleThreadSaveEdit;
    const onCancel = isRoot
      ? () => setEditingId(null)
      : () => setThreadEditingId(null);
    const onEdit = isRoot
      ? () => setEditingId(msg.id)
      : () => setThreadEditingId(msg.id);
    const onDelete = isRoot
      ? () => handleDelete(msg.id)
      : () => handleThreadDelete(msg.id);

    return (
      <div
        key={msg.id}
        className="group relative flex gap-2.5 rounded-md px-2 py-1.5 hover:bg-gray-50"
      >
        <div className="w-9 shrink-0">
          <Avatar url={msg.sender_avatar_url} name={msg.sender_name} size={36} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {msg.sender_name}
            </span>
            <span className="text-[11px] text-gray-400">
              {formatTime(msg.created_at)}
            </span>
          </div>
          {editingId2 === msg.id ? (
            <div className="mt-1">
              <EditBox
                initialValue={msg.content}
                onSave={(v) => onSave(msg.id, v)}
                onCancel={onCancel}
              />
            </div>
          ) : isDeleted ? (
            <p className="text-sm italic text-gray-400">삭제된 메시지입니다</p>
          ) : (
            <div className="flex flex-col gap-1">
              {hasAttachment && (
                <AttachmentList attachments={atts} isMine={isMine} />
              )}
              {displayText && (
                <p
                  onClick={() => hasTranslation && toggleOriginal(msg.id)}
                  className={`select-text whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800 ${
                    hasTranslation ? "cursor-pointer" : ""
                  }`}
                >
                  <MessageContent
                    text={displayText}
                    currentUserId={currentUserId}
                  />
                  {hasTranslation && (
                    <span className="ml-1.5 align-middle text-[10px] text-blue-400">
                      {t("dm.translated")}
                    </span>
                  )}
                  {msg.edited_at && (
                    <span className="ml-1.5 align-middle text-[10px] text-gray-300">
                      (수정됨)
                    </span>
                  )}
                </p>
              )}
              {isShowingOriginal && hasTranslation && (
                <div className="mt-0.5 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <p className="text-xs text-gray-600">{msg.content}</p>
                </div>
              )}
              <MessageLinkPreviews content={msg.content} />
            </div>
          )}
        </div>
        {canManage && (
          <div className="absolute right-2 top-0 -translate-y-1/2 rounded-lg border border-gray-200 bg-white opacity-0 shadow-soft-sm transition-opacity group-hover:opacity-100">
            <MessageActions
              canEdit={!hasAttachment}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="relative flex min-w-0 flex-1 flex-col" {...dropHandlers}>
      <DropOverlay visible={dragging} />
      {/* 헤더 */}
      <div className="flex h-12 items-center justify-between border-b border-gray-100 px-5">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-gray-900">
            <span className="text-gray-400"># </span>
            {channelName}
          </span>
          <span className="text-xs text-gray-600">{deptName}</span>
          <button
            type="button"
            onClick={openMembers}
            title="멤버 보기"
            className={`flex h-5 items-center gap-1 rounded-full px-1.5 text-[10px] font-medium transition-colors ${
              sidePanel?.kind === "members"
                ? "bg-blue-50 text-blue-600"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            {members.length}
          </button>
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
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
        {/* 첨부 미리보기 (전송 전 대기) */}
        <PendingAttachments
          items={pending}
          onRemove={(i) => setPending((prev) => prev.filter((_, idx) => idx !== i))}
        />
        <ComposeLinkPreview text={composerText} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2"
        >
          <div className="pb-0.5">
            <AttachmentButton onPicked={handleAttach} disabled={uploading || sending} />
          </div>
          <RichComposer
            ref={composerRef}
            members={members}
            // 전송 중에는 비활성화하지 않음 → contentEditable이 꺼지며 포커스가 풀리는 것 방지
            disabled={uploading}
            onSubmit={handleSend}
            onTextChange={(has, text) => { setComposerHasText(has); setComposerText(text); }}
            placeholder={
              uploading
                ? "업로드 중..."
                : `#${channelName} · ${t("channels.messagePlaceholder")}`
            }
          />
          <button
            type="submit"
            disabled={(!composerHasText && pending.length === 0) || sending || uploading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white transition-all duration-200 ease-spring shadow-soft-sm hover:bg-blue-600 hover:shadow-brand active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 mb-0.5"
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
      </div>

      {/* 스레드 패널 */}
      {threadRootId && (
        <div
          className="relative flex h-full w-[400px] shrink-0 flex-col border-l border-gray-200 bg-white"
          {...threadDropHandlers}
        >
          <DropOverlay visible={threadDragging} />
          {/* 스레드 헤더 */}
          <div className="flex h-12 items-center justify-between border-b border-gray-100 px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">스레드</span>
              <span className="text-xs text-gray-400">
                <span className="text-gray-300"># </span>
                {channelName}
              </span>
            </div>
            <button
              type="button"
              onClick={closeThread}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="스레드 닫기"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 스레드 본문 (루트 + 답글) */}
          <div ref={threadScrollRef} className="flex-1 overflow-y-auto px-2 py-3">
            {threadRoot && renderThreadRow(threadRoot, true)}
            <div className="my-2 flex items-center gap-3 px-2">
              <span className="text-[11px] font-medium text-gray-400">
                {threadReplies.length > 0
                  ? `${threadReplies.length}개의 답글`
                  : "아직 답글이 없어요"}
              </span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>
            {threadLoading ? (
              <div className="py-6 text-center text-xs text-gray-500">
                {t("common.loading")}
              </div>
            ) : (
              threadReplies.map((r) => renderThreadRow(r, false))
            )}
          </div>

          {/* 답글 입력 */}
          <div className="border-t border-gray-100 px-3 py-3">
            <PendingAttachments
              items={threadPending}
              size="sm"
              onRemove={(i) =>
                setThreadPending((prev) => prev.filter((_, idx) => idx !== i))
              }
            />
            <ComposeLinkPreview text={threadText} />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleThreadSend();
              }}
              className="flex items-end gap-2"
            >
              <div className="pb-0.5">
                <AttachmentButton
                  onPicked={handleThreadAttach}
                  disabled={threadUploading || threadSending}
                />
              </div>
              <RichComposer
                ref={threadComposerRef}
                members={members}
                // 전송 중에는 비활성화하지 않음 → 포커스 유지
                disabled={threadUploading}
                onSubmit={handleThreadSend}
                onTextChange={(has, text) => { setThreadHasText(has); setThreadText(text); }}
                placeholder={threadUploading ? "업로드 중..." : "답글 남기기..."}
              />
              <button
                type="submit"
                disabled={
                  (!threadHasText && threadPending.length === 0) ||
                  threadSending ||
                  threadUploading
                }
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 멤버 목록 패널 */}
      {sidePanel?.kind === "members" && (
        <MembersListPanel
          members={members as ChatMember[]}
          onClose={() => setSidePanel(null)}
          onOpenMember={openProfile}
        />
      )}

      {/* 개별 프로필 패널 */}
      {sidePanel?.kind === "profile" &&
        (() => {
          const found = memberMap.get(sidePanel.userId);
          const fallbackMsg = messages.find(
            (m) => m.sender_id === sidePanel.userId
          );
          const member: ChatMember = found ?? {
            id: sidePanel.userId,
            name: fallbackMsg?.sender_name ?? "알 수 없음",
            avatar_url: fallbackMsg?.sender_avatar_url ?? null,
          };
          return (
            <MemberProfilePanel
              member={member}
              onClose={() => setSidePanel(null)}
            />
          );
        })()}
    </div>
  );
}
