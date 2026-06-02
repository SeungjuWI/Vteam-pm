"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Avatar from "@/components/avatar";
import { getTeamMembers, getUnreadCounts } from "@/app/(dashboard)/dm/actions";
import { getGroupDmRooms, createGroupDm } from "@/app/(dashboard)/group-dm/actions";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  position: string | null;
  presence: string | null;
  last_seen_at: string | null;
  language?: string | null;
  is_bot?: boolean | null;
}

interface GroupDmRoomData {
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
  lastMessage: string | null;
  lastMessageAt: string;
  unreadCount: number;
}

const presenceColors = {
  online: "bg-emerald-400",
  away: "bg-yellow-400",
  offline: "bg-gray-300",
} as const;

function PresenceDot({ status }: { status: string | null }) {
  const color = presenceColors[(status as keyof typeof presenceColors) ?? "offline"] ?? presenceColors.offline;
  return (
    <span
      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${color}`}
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
  const t = useT();
  return (
    <button
      key={member.id}
      onDoubleClick={() => onOpenChat(member)}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-gray-50"
      title={`${member.name} - ${t("team.doubleClickToMsg")}`}
    >
      <div className="relative">
        <Avatar url={member.avatar_url} name={member.name} size={28} />
        <PresenceDot status={member.presence} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm text-gray-700">{member.name}</span>
          {member.is_bot && (
            <span className="flex h-4 items-center rounded-full bg-violet-100 px-1.5 text-[10px] font-medium text-violet-600">
              AI
            </span>
          )}
          {unreadCount ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] text-white">
              {unreadCount}
            </span>
          ) : null}
        </div>
        {member.is_bot && (
          <span className="truncate text-[11px] text-gray-400">
            {t("dm.aiAssistant")}
          </span>
        )}
      </div>
    </button>
  );
}

// 단체 DM방 생성 모달
function CreateGroupDmModal({
  members,
  currentUserId,
  onClose,
  onCreated,
}: {
  members: TeamMember[];
  currentUserId: string;
  onClose: () => void;
  onCreated: (room: GroupDmRoomData) => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const filteredMembers = members.filter(
    (m) =>
      m.id !== currentUserId &&
      !m.is_bot &&
      (m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.position?.toLowerCase().includes(search.toLowerCase()))
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size < 2) return;
    setCreating(true);
    const result = await createGroupDm(Array.from(selected), roomName || undefined);
    setCreating(false);

    if (result.roomId) {
      const selectedMembers = members.filter(
        (m) => selected.has(m.id) || m.id === currentUserId
      );
      const otherNames = selectedMembers
        .filter((m) => m.id !== currentUserId)
        .map((m) => m.name)
        .join(", ");

      onCreated({
        id: result.roomId,
        name: roomName || otherNames,
        memberCount: selected.size + 1,
        members: selectedMembers.map((m) => ({
          id: m.id,
          name: m.name,
          avatar_url: m.avatar_url,
          presence: m.presence,
          language: m.language,
        })),
        lastMessage: null,
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30">
      <div className="w-80 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="text-sm font-medium text-gray-900">
            {t("groupDm.create")}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          {/* 방 이름 (선택) */}
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder={t("groupDm.namePlaceholder")}
            className="mb-3 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none"
          />

          {/* 검색 */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("team.searchPlaceholder")}
            className="mb-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none"
          />

          {/* 멤버 선택 */}
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {filteredMembers.map((m) => (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                  selected.has(m.id) ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="relative">
                  <Avatar url={m.avatar_url} name={m.name} size={24} />
                </div>
                <span className="flex-1 truncate text-sm text-gray-700">{m.name}</span>
                {selected.has(m.id) && (
                  <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* 선택된 멤버 수 */}
          {selected.size > 0 && (
            <div className="mt-2 text-xs text-gray-400">
              {selected.size}{t("groupDm.selected")}
            </div>
          )}
        </div>
        <div className="border-t border-gray-100 px-4 py-3">
          <button
            onClick={handleCreate}
            disabled={selected.size < 2 || creating}
            className="w-full rounded-lg bg-blue-500 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {creating ? t("common.creating") : t("groupDm.createButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SidebarTeamList({
  onOpenChat,
  onOpenGroupChat,
  currentUserId,
}: {
  onOpenChat: (member: TeamMember) => void;
  onOpenGroupChat?: (room: GroupDmRoomData) => void;
  currentUserId?: string;
}) {
  const t = useT();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const [groupRooms, setGroupRooms] = useState<GroupDmRoomData[]>([]);
  const [showGroupRooms, setShowGroupRooms] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchData = useCallback(async () => {
    const [membersData, counts, rooms] = await Promise.all([
      getTeamMembers(),
      getUnreadCounts(),
      getGroupDmRooms(),
    ]);
    setMembers(membersData as TeamMember[]);
    setUnreadCounts(counts);
    setGroupRooms(rooms as GroupDmRoomData[]);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages" },
        () => {
          getUnreadCounts().then(setUnreadCounts);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_dm_messages" },
        () => {
          getGroupDmRooms().then((rooms) => setGroupRooms(rooms as GroupDmRoomData[]));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_dm_members" },
        () => {
          getGroupDmRooms().then((rooms) => setGroupRooms(rooms as GroupDmRoomData[]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const { activeMembers, offlineMembers, onlineCount } = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      // 봇은 항상 최상단
      if (a.is_bot && !b.is_bot) return -1;
      if (!a.is_bot && b.is_bot) return 1;
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

  const totalGroupUnread = groupRooms.reduce((acc, r) => acc + r.unreadCount, 0);

  const handleGroupCreated = (room: GroupDmRoomData) => {
    setGroupRooms((prev) => [room, ...prev]);
    onOpenGroupChat?.(room);
  };

  return (
    <div className="border-t border-gray-200 px-3 py-2">
      {/* 단체 DM 섹션 */}
      {groupRooms.length > 0 && (
        <div className="mb-1">
          <div className="flex items-center justify-between px-3 py-1.5">
            <button
              onClick={() => setShowGroupRooms(!showGroupRooms)}
              className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-gray-400 hover:text-gray-600"
            >
              <svg
                className={`h-3 w-3 transition-transform ${showGroupRooms ? "" : "-rotate-90"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              {t("groupDm.title")} {totalGroupUnread > 0 && `(${totalGroupUnread})`}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title={t("groupDm.create")}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>

          {showGroupRooms && (
            <div className="space-y-0.5">
              {groupRooms.map((room) => (
                <button
                  key={room.id}
                  onDoubleClick={() => onOpenGroupChat?.(room)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-gray-50"
                  title={t("team.doubleClickToMsg")}
                >
                  {/* 겹친 아바타 */}
                  <div className="relative flex -space-x-1.5">
                    {room.members
                      .filter((m) => m.id !== currentUserId)
                      .slice(0, 2)
                      .map((m) => (
                        <div key={m.id} className="rounded-full border border-white">
                          <Avatar url={m.avatar_url} name={m.name} size={14} />
                        </div>
                      ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="max-w-28 truncate text-sm text-gray-700">
                        {room.name}
                      </span>
                      <span className="text-[10px] text-gray-400">{room.memberCount}</span>
                      {room.unreadCount > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] text-white">
                          {room.unreadCount}
                        </span>
                      )}
                    </div>
                    {room.lastMessage && (
                      <span className="block max-w-32 truncate text-[11px] text-gray-400">
                        {room.lastMessage}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[11px] font-medium tracking-wide text-gray-400">
          {t("team.title")} {onlineCount > 0 && `(${onlineCount})`}
        </span>
        <div className="flex items-center gap-1">
          {/* 단체 DM 생성 (방이 없을 때도 접근 가능) */}
          {groupRooms.length === 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title={t("groupDm.create")}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </button>
          )}
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
      </div>

      {/* 검색 */}
      {showSearch && (
        <div className="px-2 pb-1.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("team.searchPlaceholder")}
            autoFocus
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none"
          />
        </div>
      )}

      {/* 활동중 + 자리비움 */}
      <div className="space-y-0.5">
        {loading ? (
          <div className="px-3 py-2 text-xs text-gray-400">{t("common.loading")}</div>
        ) : activeMembers.length === 0 && offlineMembers.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-400">
            {search ? t("team.noResults") : t("team.noMembers")}
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
            <span>{t("dm.offline")} ({offlineMembers.length})</span>
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

      {/* 단체 DM 생성 모달 */}
      {showCreateModal && currentUserId && (
        <CreateGroupDmModal
          members={members}
          currentUserId={currentUserId}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}
