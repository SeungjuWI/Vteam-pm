"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Avatar from "@/components/avatar";
import { getTeamMembers, getUnreadCounts } from "@/app/(dashboard)/dm/actions";
import { createClient } from "@/lib/supabase/client";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  position: string | null;
  presence: string | null;
  last_seen_at: string | null;
  language?: string | null;
}

const presenceConfig = {
  online: { color: "bg-emerald-400", label: "활동중" },
  away: { color: "bg-yellow-400", label: "자리비움" },
  offline: { color: "bg-gray-300", label: "오프라인" },
} as const;

function PresenceDot({ status }: { status: string | null }) {
  const config = presenceConfig[(status as keyof typeof presenceConfig) ?? "offline"] ?? presenceConfig.offline;
  return (
    <span
      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${config.color}`}
      title={config.label}
    />
  );
}

function MemberRow({
  member,
  unreadCount,
  onOpenChat,
}: {
  member: TeamMember;
  unreadCount?: number;
  onOpenChat: (member: TeamMember) => void;
}) {
  return (
    <button
      key={member.id}
      onDoubleClick={() => onOpenChat(member)}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-gray-50"
      title={`더블클릭하여 ${member.name}님에게 메시지 보내기`}
    >
      <div className="relative">
        <Avatar url={member.avatar_url} name={member.name} size={28} />
        <PresenceDot status={member.presence} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm text-gray-700">{member.name}</span>
          {unreadCount ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] text-white">
              {unreadCount}
            </span>
          ) : null}
        </div>
        {member.position && (
          <span className="truncate text-[11px] text-gray-400">{member.position}</span>
        )}
      </div>
    </button>
  );
}

export default function SidebarTeamList({
  onOpenChat,
}: {
  onOpenChat: (member: TeamMember) => void;
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showOffline, setShowOffline] = useState(false);

  const fetchData = useCallback(async () => {
    const [membersData, counts] = await Promise.all([
      getTeamMembers(),
      getUnreadCounts(),
    ]);
    setMembers(membersData as TeamMember[]);
    setUnreadCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const supabase = createClient();
    const channel = supabase
      .channel("team-presence")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: "presence=neq." },
        (payload) => {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === payload.new.id
                ? { ...m, presence: payload.new.presence, last_seen_at: payload.new.last_seen_at }
                : m
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        () => {
          getUnreadCounts().then(setUnreadCounts);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const { activeMembers, offlineMembers, onlineCount } = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      const order = { online: 0, away: 1, offline: 2 };
      const aOrder = order[(a.presence as keyof typeof order) ?? "offline"] ?? 2;
      const bOrder = order[(b.presence as keyof typeof order) ?? "offline"] ?? 2;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });

    const filtered = search
      ? sorted.filter(
          (m) =>
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.position?.toLowerCase().includes(search.toLowerCase())
        )
      : sorted;

    return {
      activeMembers: filtered.filter((m) => m.presence === "online" || m.presence === "away"),
      offlineMembers: filtered.filter((m) => !m.presence || m.presence === "offline"),
      onlineCount: members.filter((m) => m.presence === "online").length,
    };
  }, [members, search]);

  return (
    <div className="border-t border-gray-200 px-3 py-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[11px] font-medium tracking-wide text-gray-400">
          팀원 {onlineCount > 0 && `(${onlineCount})`}
        </span>
        <button
          onClick={() => {
            setShowSearch(!showSearch);
            if (showSearch) setSearch("");
          }}
          className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </button>
      </div>

      {/* 검색 */}
      {showSearch && (
        <div className="px-2 pb-1.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 직책 검색..."
            autoFocus
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none"
          />
        </div>
      )}

      {/* 활동중 + 자리비움 */}
      <div className="space-y-0.5">
        {loading ? (
          <div className="px-3 py-2 text-xs text-gray-400">불러오는 중...</div>
        ) : activeMembers.length === 0 && offlineMembers.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-400">
            {search ? "검색 결과가 없습니다" : "팀원이 없습니다"}
          </div>
        ) : (
          activeMembers.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              unreadCount={unreadCounts[member.id]}
              onOpenChat={onOpenChat}
            />
          ))
        )}
      </div>

      {/* 오프라인 섹션 */}
      {!loading && offlineMembers.length > 0 && (
        <div className="mt-1">
          <button
            onClick={() => setShowOffline(!showOffline)}
            className="flex w-full items-center gap-1.5 px-3 py-1 text-[11px] text-gray-400 hover:text-gray-600"
          >
            <svg
              className={`h-3 w-3 transition-transform ${showOffline ? "" : "-rotate-90"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span>오프라인 ({offlineMembers.length})</span>
          </button>
          {showOffline && (
            <div className="space-y-0.5">
              {offlineMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  unreadCount={unreadCounts[member.id]}
                  onOpenChat={onOpenChat}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
