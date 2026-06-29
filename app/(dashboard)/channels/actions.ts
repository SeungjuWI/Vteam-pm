"use server";

import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { translateText } from "@/lib/translate";
import { extractMentionIds, stripChatMarkup } from "@/lib/chat-markup";

// ===== 공통 헬퍼 =====

async function getMe() {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, company_id, role, language")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;
  return { userId: user.id, profile, adminClient };
}

// 채널이 내 회사 소속인지 검증 (멀티테넌트 격리)
async function channelInCompany(adminClient: ReturnType<typeof createAdminClient>, channelId: string, companyId: string): Promise<boolean> {
  const { data: ch } = await adminClient.from("dept_channels").select("department_id").eq("id", channelId).single();
  if (!ch) return false;
  const { data: dept } = await adminClient.from("departments").select("company_id").eq("id", ch.department_id).single();
  return !!dept && dept.company_id === companyId;
}

// 채널 메시지 select 컬럼 (본문/답글 공통)
const CHANNEL_MSG_COLUMNS =
  "id, channel_id, sender_id, content, sender_language, created_at, edited_at, deleted_at, attachment_url, attachment_type, attachment_name, thread_root_id";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawChannelMsg = any;

// 메시지 행에 발신자 정보 + 번역(캐시 우선)을 합성한다. 본문/스레드 답글 공용.
async function hydrateChannelMessages(
  adminClient: ReturnType<typeof createAdminClient>,
  rows: RawChannelMsg[],
  userId: string,
  myLang: string
) {
  if (rows.length === 0) return [];

  const senderIds = [...new Set(rows.map((m) => m.sender_id))];
  const { data: senders } = await adminClient
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", senderIds);
  const senderMap = new Map((senders ?? []).map((s) => [s.id, s]));

  const needsTranslation = rows.filter(
    (m) =>
      m.sender_id !== userId &&
      m.content &&
      !m.deleted_at &&
      m.sender_language &&
      m.sender_language !== myLang
  );

  let cacheMap = new Map<string, string>();
  if (needsTranslation.length > 0) {
    const msgIds = needsTranslation.map((m) => m.id);
    const { data: cached } = await adminClient
      .from("dept_channel_translations")
      .select("message_id, translated_content")
      .in("message_id", msgIds)
      .eq("target_language", myLang);

    cacheMap = new Map(
      (cached ?? []).map((t) => [t.message_id, t.translated_content])
    );

    const uncached = needsTranslation.filter((m) => !cacheMap.has(m.id));
    if (uncached.length > 0) {
      const translations = await Promise.all(
        uncached.map(async (m) => ({
          message_id: m.id,
          target_language: myLang,
          translated_content: await translateText(
            m.content,
            m.sender_language!,
            myLang
          ),
        }))
      );
      await adminClient.from("dept_channel_translations").upsert(translations, {
        onConflict: "message_id,target_language",
      });
      for (const t of translations) cacheMap.set(t.message_id, t.translated_content);
    }
  }

  return rows.map((m) => {
    const sender = senderMap.get(m.sender_id);
    return {
      ...m,
      sender_name: sender?.name ?? "알 수 없음",
      sender_avatar_url: sender?.avatar_url ?? null,
      translated_content:
        m.sender_id !== userId && m.sender_language !== myLang
          ? cacheMap.get(m.id) ?? null
          : null,
    };
  });
}

// ===== 부서 관리 (admin 전용) =====

// 회사 전체 부서 + 멤버 + 채널 (관리 패널용)
export async function getCompanyDepartments() {
  const me = await getMe();
  if (!me) return [];
  const { profile, adminClient } = me;

  const { data: departments } = await adminClient
    .from("departments")
    .select("id, name, color, description, created_at")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: true });

  if (!departments || departments.length === 0) return [];

  const deptIds = departments.map((d) => d.id);

  const [{ data: members }, { data: channels }] = await Promise.all([
    adminClient
      .from("department_members")
      .select("department_id, user_id")
      .in("department_id", deptIds),
    adminClient
      .from("dept_channels")
      .select("id, department_id, name, created_at")
      .in("department_id", deptIds)
      .order("created_at", { ascending: true }),
  ]);

  const memberUserIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const { data: profiles } = memberUserIds.length
    ? await adminClient
        .from("profiles")
        .select("id, name, avatar_url, position")
        .in("id", memberUserIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return departments.map((dept) => ({
    id: dept.id,
    name: dept.name,
    color: dept.color,
    description: dept.description,
    members: (members ?? [])
      .filter((m) => m.department_id === dept.id)
      .map((m) => profileMap.get(m.user_id))
      .filter(Boolean)
      .map((p) => ({
        id: p!.id,
        name: p!.name,
        avatar_url: p!.avatar_url,
        position: p!.position,
      })),
    channels: (channels ?? [])
      .filter((c) => c.department_id === dept.id)
      .map((c) => ({ id: c.id, name: c.name })),
  }));
}

// 회사 멤버 목록 (부서 배정 선택용)
export async function getCompanyMembers() {
  const me = await getMe();
  if (!me) return [];
  const { profile, adminClient } = me;

  const { data } = await adminClient
    .from("profiles")
    .select("id, name, avatar_url, position")
    .eq("company_id", profile.company_id)
    .eq("status", "active")
    .neq("is_bot", true)
    .order("name", { ascending: true });

  return data ?? [];
}

export async function createDepartment(
  name: string,
  color: string,
  description?: string
) {
  const me = await getMe();
  if (!me) return { error: "로그인이 필요합니다" };
  const { userId, profile, adminClient } = me;
  if (profile.role !== "admin") return { error: "권한이 없습니다" };

  const trimmed = name.trim();
  if (!trimmed) return { error: "부서 이름을 입력해주세요" };

  const { data: dept, error } = await adminClient
    .from("departments")
    .insert({
      company_id: profile.company_id,
      name: trimmed,
      color: color || "#3182F6",
      description: description?.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !dept) return { error: "부서 생성에 실패했습니다" };

  // 생성자 자동 멤버 추가 + 기본 채널 #일반 생성
  await adminClient.from("department_members").insert({
    department_id: dept.id,
    user_id: userId,
  });
  await adminClient.from("dept_channels").insert({
    department_id: dept.id,
    name: "일반",
    created_by: userId,
  });

  return { success: true, departmentId: dept.id };
}

export async function updateDepartment(
  departmentId: string,
  updates: { name?: string; color?: string; description?: string }
) {
  const me = await getMe();
  if (!me) return { error: "로그인이 필요합니다" };
  const { profile, adminClient } = me;
  if (profile.role !== "admin") return { error: "권한이 없습니다" };

  const patch: Record<string, string | null> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.color !== undefined) patch.color = updates.color;
  if (updates.description !== undefined)
    patch.description = updates.description.trim() || null;

  const { error } = await adminClient
    .from("departments")
    .update(patch)
    .eq("id", departmentId)
    .eq("company_id", profile.company_id);

  if (error) return { error: "수정에 실패했습니다" };
  return { success: true };
}

export async function deleteDepartment(departmentId: string) {
  const me = await getMe();
  if (!me) return { error: "로그인이 필요합니다" };
  const { profile, adminClient } = me;
  if (profile.role !== "admin") return { error: "권한이 없습니다" };

  const { error } = await adminClient
    .from("departments")
    .delete()
    .eq("id", departmentId)
    .eq("company_id", profile.company_id);

  if (error) return { error: "삭제에 실패했습니다" };
  return { success: true };
}

export async function addDepartmentMembers(
  departmentId: string,
  userIds: string[]
) {
  const me = await getMe();
  if (!me) return { error: "로그인이 필요합니다" };
  const { profile, adminClient } = me;
  if (profile.role !== "admin") return { error: "권한이 없습니다" };
  if (userIds.length === 0) return { success: true };

  // 부서가 같은 회사인지 확인
  const { data: dept } = await adminClient
    .from("departments")
    .select("company_id")
    .eq("id", departmentId)
    .single();
  if (!dept || dept.company_id !== profile.company_id)
    return { error: "권한이 없습니다" };

  const rows = userIds.map((uid) => ({
    department_id: departmentId,
    user_id: uid,
  }));
  const { error } = await adminClient
    .from("department_members")
    .upsert(rows, { onConflict: "department_id,user_id", ignoreDuplicates: true });

  if (error) return { error: "멤버 추가에 실패했습니다" };
  return { success: true };
}

export async function removeDepartmentMember(
  departmentId: string,
  userId: string
) {
  const me = await getMe();
  if (!me) return { error: "로그인이 필요합니다" };
  const { profile, adminClient } = me;
  if (profile.role !== "admin") return { error: "권한이 없습니다" };

  const { error } = await adminClient
    .from("department_members")
    .delete()
    .eq("department_id", departmentId)
    .eq("user_id", userId);

  if (error) return { error: "멤버 제거에 실패했습니다" };
  return { success: true };
}

// ===== 채널 / 메시지 (부서원 누구나) =====

// 내가 속한 부서 + 채널 + 채널별 안읽음 수
export async function getMyChannels() {
  const me = await getMe();
  if (!me) return [];
  const { userId, adminClient } = me;

  // 내가 속한 부서
  const { data: myMemberships } = await adminClient
    .from("department_members")
    .select("department_id")
    .eq("user_id", userId);

  const deptIds = [...new Set((myMemberships ?? []).map((m) => m.department_id))];
  if (deptIds.length === 0) return [];

  const [{ data: departments }, { data: channels }] = await Promise.all([
    adminClient
      .from("departments")
      .select("id, name, color")
      .in("id", deptIds)
      .order("created_at", { ascending: true }),
    adminClient
      .from("dept_channels")
      .select("id, department_id, name")
      .in("department_id", deptIds)
      .order("created_at", { ascending: true }),
  ]);

  const channelIds = (channels ?? []).map((c) => c.id);

  // 내 읽음 기록
  const { data: reads } = channelIds.length
    ? await adminClient
        .from("dept_channel_reads")
        .select("channel_id, last_read_at")
        .eq("user_id", userId)
        .in("channel_id", channelIds)
    : { data: [] };
  const readMap = new Map(
    (reads ?? []).map((r) => [r.channel_id, r.last_read_at])
  );

  // 채널별 안읽음 수 (내가 보낸 것 제외, last_read_at 이후)
  const unreadCounts = await Promise.all(
    channelIds.map(async (channelId) => {
      const lastRead = readMap.get(channelId);
      let query = adminClient
        .from("dept_channel_messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", channelId)
        .neq("sender_id", userId);
      if (lastRead) query = query.gt("created_at", lastRead);
      const { count } = await query;
      return { channelId, count: count ?? 0 };
    })
  );
  const unreadMap = new Map(unreadCounts.map((u) => [u.channelId, u.count]));

  return (departments ?? []).map((dept) => ({
    id: dept.id,
    name: dept.name,
    color: dept.color,
    channels: (channels ?? [])
      .filter((c) => c.department_id === dept.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        departmentId: c.department_id,
        unreadCount: unreadMap.get(c.id) ?? 0,
      })),
  }));
}

export async function createChannel(departmentId: string, name: string) {
  const me = await getMe();
  if (!me) return { error: "로그인이 필요합니다" };
  const { userId, adminClient } = me;

  const trimmed = name.trim();
  if (!trimmed) return { error: "채널 이름을 입력해주세요" };

  // 내가 그 부서 멤버인지 확인
  const { data: membership } = await adminClient
    .from("department_members")
    .select("id")
    .eq("department_id", departmentId)
    .eq("user_id", userId)
    .single();
  if (!membership) return { error: "해당 부서의 멤버가 아닙니다" };

  const { data: channel, error } = await adminClient
    .from("dept_channels")
    .insert({
      department_id: departmentId,
      name: trimmed,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !channel) return { error: "채널 생성에 실패했습니다" };
  return { success: true, channelId: channel.id };
}

// 채널 멤버(=부서 멤버) 프로필
export async function getChannelMembers(channelId: string) {
  const me = await getMe();
  if (!me) return [];
  const { adminClient } = me;

  const { data: channel } = await adminClient
    .from("dept_channels")
    .select("department_id")
    .eq("id", channelId)
    .single();
  if (!channel) return [];

  const { data: members } = await adminClient
    .from("department_members")
    .select("user_id")
    .eq("department_id", channel.department_id);

  const userIds = (members ?? []).map((m) => m.user_id);
  if (userIds.length === 0) return [];

  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, name, avatar_url, presence, language")
    .in("id", userIds);

  return profiles ?? [];
}

// 채널 메시지 조회 (번역 포함)
export async function getChannelMessages(channelId: string) {
  const me = await getMe();
  if (!me) return [];
  const { userId, profile, adminClient } = me;
  if (!(await channelInCompany(adminClient, channelId, profile.company_id))) return [];
  const myLang = profile.language ?? "ko";

  // 본문 메시지만 (스레드 답글 thread_root_id != null 은 제외)
  const { data } = await adminClient
    .from("dept_channel_messages")
    .select(CHANNEL_MSG_COLUMNS)
    .eq("channel_id", channelId)
    .is("thread_root_id", null)
    .order("created_at", { ascending: true })
    .limit(100);

  if (!data) return [];

  // 각 본문 메시지의 답글 수 + 마지막 답글 시각 집계
  const rootIds = data.map((m) => m.id);
  const replyMeta = new Map<string, { count: number; last: string }>();
  if (rootIds.length > 0) {
    const { data: replies } = await adminClient
      .from("dept_channel_messages")
      .select("thread_root_id, created_at")
      .in("thread_root_id", rootIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    for (const r of replies ?? []) {
      const prev = replyMeta.get(r.thread_root_id);
      if (prev) {
        prev.count += 1;
        prev.last = r.created_at;
      } else {
        replyMeta.set(r.thread_root_id, { count: 1, last: r.created_at });
      }
    }
  }

  const hydrated = await hydrateChannelMessages(adminClient, data, userId, myLang);
  return hydrated.map((m) => {
    const rc = replyMeta.get(m.id);
    return { ...m, reply_count: rc?.count ?? 0, last_reply_at: rc?.last ?? null };
  });
}

// 스레드 루트 + 답글 목록 조회
export async function getThreadReplies(rootId: string) {
  const me = await getMe();
  if (!me) return { root: null, replies: [] };
  const { userId, profile, adminClient } = me;
  const myLang = profile.language ?? "ko";

  const { data: rootRow } = await adminClient
    .from("dept_channel_messages")
    .select(CHANNEL_MSG_COLUMNS)
    .eq("id", rootId)
    .single();
  if (!rootRow) return { root: null, replies: [] };
  if (!(await channelInCompany(adminClient, rootRow.channel_id, profile.company_id)))
    return { root: null, replies: [] };

  const { data: replyRows } = await adminClient
    .from("dept_channel_messages")
    .select(CHANNEL_MSG_COLUMNS)
    .eq("thread_root_id", rootId)
    .order("created_at", { ascending: true });

  const [root] = await hydrateChannelMessages(adminClient, [rootRow], userId, myLang);
  const replies = await hydrateChannelMessages(
    adminClient,
    replyRows ?? [],
    userId,
    myLang
  );
  return { root, replies };
}

export async function sendChannelMessage(
  channelId: string,
  content: string,
  attachment?: { url: string; type: "image" | "video" | "file"; name: string } | null,
  threadRootId?: string | null
) {
  const me = await getMe();
  if (!me) return { error: "로그인이 필요합니다" };
  const { userId, profile, adminClient } = me;
  if (!(await channelInCompany(adminClient, channelId, profile.company_id))) return { error: "권한이 없습니다" };

  const text = content.trim();
  if (!text && !attachment) return { error: "내용을 입력해주세요" };

  const { data, error } = await adminClient
    .from("dept_channel_messages")
    .insert({
      channel_id: channelId,
      sender_id: userId,
      content: text,
      sender_language: profile.language ?? "ko",
      attachment_url: attachment?.url ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_name: attachment?.name ?? null,
      thread_root_id: threadRootId ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: "메시지 전송에 실패했습니다" };

  // 멘션된 사용자에게 벨 알림 생성 (본인 제외, 채널 멤버만)
  const mentionIds = extractMentionIds(text).filter((id) => id !== userId);
  if (mentionIds.length > 0) {
    const { data: channel } = await adminClient
      .from("dept_channels")
      .select("name, department_id")
      .eq("id", channelId)
      .single();
    const { data: sender } = await adminClient
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .single();
    // 멘션 대상이 같은 회사 멤버인지 확인 (잘못된/외부 uid 방지)
    const { data: validMembers } = await adminClient
      .from("profiles")
      .select("id")
      .in("id", mentionIds)
      .eq("company_id", profile.company_id);
    const validIds = (validMembers ?? []).map((m) => m.id);

    if (validIds.length > 0) {
      const senderName = sender?.name ?? "누군가";
      const channelName = channel?.name ?? "채널";
      const snippet = stripChatMarkup(text).slice(0, 80);
      await adminClient.from("notifications").insert(
        validIds.map((mid) => ({
          user_id: mid,
          company_id: profile.company_id,
          type: "general",
          title: `${senderName}님이 회원님을 멘션했어요`,
          message: `#${channelName}: ${snippet}`,
          link: `/channels?channel=${channelId}`,
        }))
      );
    }
  }

  return { success: true, id: data.id as string };
}

export async function markChannelAsRead(channelId: string) {
  const me = await getMe();
  if (!me) return;
  const { userId, profile, adminClient } = me;
  if (!(await channelInCompany(adminClient, channelId, profile.company_id))) return;

  await adminClient.from("dept_channel_reads").upsert(
    {
      channel_id: channelId,
      user_id: userId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "channel_id,user_id" }
  );
}

export async function translateSingleChannelMessage(
  messageId: string,
  content: string,
  fromLang: string
) {
  const me = await getMe();
  if (!me) return { error: "로그인이 필요합니다" };
  const { profile, adminClient } = me;
  const myLang = profile.language ?? "ko";

  if (fromLang === myLang) return { translated: content };

  const { data: cached } = await adminClient
    .from("dept_channel_translations")
    .select("translated_content")
    .eq("message_id", messageId)
    .eq("target_language", myLang)
    .single();

  if (cached) return { translated: cached.translated_content };

  const translated = await translateText(content, fromLang, myLang);

  await adminClient.from("dept_channel_translations").upsert(
    {
      message_id: messageId,
      target_language: myLang,
      translated_content: translated,
    },
    { onConflict: "message_id,target_language" }
  );

  return { translated };
}
