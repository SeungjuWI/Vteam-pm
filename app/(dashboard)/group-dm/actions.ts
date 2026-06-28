"use server";

import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { translateText } from "@/lib/translate";

// 내가 이 방의 멤버인지 검증 (멀티테넌트 격리)
async function inGroupRoom(adminClient: ReturnType<typeof createAdminClient>, roomId: string, userId: string): Promise<boolean> {
  const { data } = await adminClient.from("group_dm_members").select("id").eq("room_id", roomId).eq("user_id", userId).maybeSingle();
  return !!data;
}

// 단체 DM방 생성
export async function createGroupDm(memberIds: string[], name?: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return { error: "회사 정보가 없습니다" };

  // 본인을 포함한 전체 멤버 (최소 3명 이상)
  const allMemberIds = Array.from(new Set([user.id, ...memberIds]));
  if (allMemberIds.length < 3) return { error: "3명 이상 선택해주세요" };

  // 방 생성
  const { data: room, error: roomError } = await adminClient
    .from("group_dm_rooms")
    .insert({
      company_id: profile.company_id,
      name: name || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (roomError || !room) return { error: "방 생성에 실패했습니다" };

  // 멤버 추가
  const members = allMemberIds.map((uid) => ({
    room_id: room.id,
    user_id: uid,
  }));

  await adminClient.from("group_dm_members").insert(members);

  return { roomId: room.id };
}

// 내 단체 DM방 목록
export async function getGroupDmRooms() {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return [];

  const adminClient = createAdminClient();

  // 내가 속한 방 조회
  const { data: myRooms } = await adminClient
    .from("group_dm_members")
    .select("room_id")
    .eq("user_id", user.id);

  if (!myRooms || myRooms.length === 0) return [];

  const roomIds = myRooms.map((r) => r.room_id);

  // 방 정보
  const { data: rooms } = await adminClient
    .from("group_dm_rooms")
    .select("id, name, created_at")
    .in("id", roomIds)
    .order("created_at", { ascending: false });

  if (!rooms) return [];

  // 각 방의 멤버 정보
  const { data: allMembers } = await adminClient
    .from("group_dm_members")
    .select("room_id, user_id, last_read_at")
    .in("room_id", roomIds);

  const memberUserIds = [...new Set((allMembers ?? []).map((m) => m.user_id))];
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, name, avatar_url, presence, language")
    .in("id", memberUserIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  // 각 방의 마지막 메시지
  const lastMsgPromises = roomIds.map(async (roomId) => {
    const { data } = await adminClient
      .from("group_dm_messages")
      .select("content, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return { roomId, lastMessage: data };
  });

  const lastMessages = await Promise.all(lastMsgPromises);
  const lastMsgMap = new Map(lastMessages.map((m) => [m.roomId, m.lastMessage]));

  // 안읽은 메시지 수 계산
  const unreadPromises = roomIds.map(async (roomId) => {
    const myMembership = (allMembers ?? []).find(
      (m) => m.room_id === roomId && m.user_id === user.id
    );
    if (!myMembership) return { roomId, count: 0 };

    const { count } = await adminClient
      .from("group_dm_messages")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .neq("sender_id", user.id)
      .gt("created_at", myMembership.last_read_at);

    return { roomId, count: count ?? 0 };
  });

  const unreadCounts = await Promise.all(unreadPromises);
  const unreadMap = new Map(unreadCounts.map((u) => [u.roomId, u.count]));

  return rooms.map((room) => {
    const roomMembers = (allMembers ?? [])
      .filter((m) => m.room_id === room.id)
      .map((m) => profileMap.get(m.user_id))
      .filter(Boolean);

    const otherMembers = roomMembers.filter((m) => m!.id !== user.id);
    const displayName =
      room.name || otherMembers.map((m) => m!.name).join(", ");

    return {
      id: room.id,
      name: displayName,
      memberCount: roomMembers.length,
      members: roomMembers.map((m) => ({
        id: m!.id,
        name: m!.name,
        avatar_url: m!.avatar_url,
        presence: m!.presence,
        language: m!.language,
      })),
      lastMessage: lastMsgMap.get(room.id)?.content ?? null,
      lastMessageAt: lastMsgMap.get(room.id)?.created_at ?? room.created_at,
      unreadCount: unreadMap.get(room.id) ?? 0,
    };
  });
}

// 단체 DM 메시지 조회 (번역 포함)
export async function getGroupDmMessages(roomId: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return [];

  const adminClient = createAdminClient();
  if (!(await inGroupRoom(adminClient, roomId, user.id))) return [];

  // 내 언어
  const { data: myProfile } = await adminClient
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .single();
  const myLang = myProfile?.language ?? "ko";

  // 메시지 로드
  const { data } = await adminClient
    .from("group_dm_messages")
    .select(
      "id, room_id, sender_id, content, sender_language, created_at, edited_at, deleted_at, attachment_url, attachment_type, attachment_name"
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (!data) return [];

  // 발신자 프로필
  const senderIds = [...new Set(data.map((m) => m.sender_id))];
  const { data: senders } = await adminClient
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", senderIds);
  const senderMap = new Map((senders ?? []).map((s) => [s.id, s]));

  // 번역이 필요한 메시지 (삭제/첨부전용 제외)
  const needsTranslation = data.filter(
    (m) =>
      m.sender_id !== user.id &&
      m.content &&
      !m.deleted_at &&
      m.sender_language &&
      m.sender_language !== myLang
  );

  let cacheMap = new Map<string, string>();

  if (needsTranslation.length > 0) {
    const msgIds = needsTranslation.map((m) => m.id);
    const { data: cached } = await adminClient
      .from("group_dm_translations")
      .select("message_id, translated_content")
      .in("message_id", msgIds)
      .eq("target_language", myLang);

    cacheMap = new Map(
      (cached ?? []).map((t) => [t.message_id, t.translated_content])
    );

    // 캐시에 없는 것 번역
    const uncached = needsTranslation.filter((m) => !cacheMap.has(m.id));
    if (uncached.length > 0) {
      const translations = await Promise.all(
        uncached.map(async (m) => {
          const translated = await translateText(m.content, m.sender_language!, myLang);
          return { message_id: m.id, target_language: myLang, translated_content: translated };
        })
      );

      if (translations.length > 0) {
        await adminClient.from("group_dm_translations").upsert(translations, {
          onConflict: "message_id,target_language",
        });
      }

      for (const t of translations) {
        cacheMap.set(t.message_id, t.translated_content);
      }
    }
  }

  return data.map((m) => {
    const sender = senderMap.get(m.sender_id);
    return {
      ...m,
      sender_name: sender?.name ?? "알 수 없음",
      sender_avatar_url: sender?.avatar_url ?? null,
      translated_content:
        m.sender_id !== user.id && m.sender_language !== myLang
          ? cacheMap.get(m.id) ?? null
          : null,
    };
  });
}

// 단체 DM 메시지 전송
export async function sendGroupDmMessage(
  roomId: string,
  content: string,
  attachment?: { url: string; type: "image" | "video" | "file"; name: string } | null
) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const text = content.trim();
  if (!text && !attachment) return { error: "내용을 입력해주세요" };

  const adminClient = createAdminClient();
  if (!(await inGroupRoom(adminClient, roomId, user.id))) return { error: "이 방의 멤버가 아닙니다" };
  const { data: profile } = await adminClient
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .single();

  const { error } = await adminClient.from("group_dm_messages").insert({
    room_id: roomId,
    sender_id: user.id,
    content: text,
    sender_language: profile?.language ?? "ko",
    attachment_url: attachment?.url ?? null,
    attachment_type: attachment?.type ?? null,
    attachment_name: attachment?.name ?? null,
  });

  if (error) return { error: "메시지 전송에 실패했습니다" };
  return { success: true };
}

// 읽음 처리
export async function markGroupDmAsRead(roomId: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return;

  const adminClient = createAdminClient();
  await adminClient
    .from("group_dm_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", user.id);
}

// 단건 번역
export async function translateSingleGroupMessage(
  messageId: string,
  content: string,
  fromLang: string
) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const adminClient = createAdminClient();
  const { data: myProfile } = await adminClient
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .single();
  const myLang = myProfile?.language ?? "ko";

  if (fromLang === myLang) return { translated: content };

  // 캐시 확인
  const { data: cached } = await adminClient
    .from("group_dm_translations")
    .select("translated_content")
    .eq("message_id", messageId)
    .eq("target_language", myLang)
    .single();

  if (cached) return { translated: cached.translated_content };

  const translated = await translateText(content, fromLang, myLang);

  await adminClient.from("group_dm_translations").upsert(
    { message_id: messageId, target_language: myLang, translated_content: translated },
    { onConflict: "message_id,target_language" }
  );

  return { translated };
}

// 방 멤버 정보 조회
export async function getGroupDmRoomMembers(roomId: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return [];

  const adminClient = createAdminClient();

  const { data: members } = await adminClient
    .from("group_dm_members")
    .select("user_id")
    .eq("room_id", roomId);

  if (!members) return [];

  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, name, avatar_url, presence, language")
    .in("id", userIds);

  return profiles ?? [];
}
