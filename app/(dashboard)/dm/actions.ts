"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { translateText } from "@/lib/translate";
import { generateBotResponse } from "@/lib/ai-chat";

// Sean 봇을 회사에 등록 (없으면 생성)
export async function ensureBotExists(companyId: string) {
  const adminClient = createAdminClient();

  // 이미 봇이 있는지 확인
  const { data: existing } = await adminClient
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_bot", true)
    .single();

  if (existing) {
    // avatar 최신화
    await adminClient
      .from("profiles")
      .update({ avatar_url: "/sean-avatar.png" })
      .eq("id", existing.id);
    return existing.id as string;
  }

  // 봇용 auth user 생성
  const botEmail = `sean-bot-${companyId.slice(0, 8)}@vteam.internal`;
  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: botEmail,
    password: crypto.randomUUID(),
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    // 이미 생성된 이메일이면 기존 유저 조회
    const { data: users } = await adminClient.auth.admin.listUsers();
    const found = users?.users?.find((u) => u.email === botEmail);
    if (found) {
      // 프로필만 생성
      await adminClient.from("profiles").upsert({
        id: found.id,
        email: botEmail,
        name: "Sean",
        role: "employee",
        company_id: companyId,
        position: "AI 어시스턴트",
        avatar_url: "/sean-avatar.png",
        status: "active",
        is_bot: true,
        presence: "online",
        language: "ko",
      });
      return found.id;
    }
    throw new Error("봇 생성 실패");
  }

  // 프로필 생성
  await adminClient.from("profiles").insert({
    id: authUser.user.id,
    email: botEmail,
    name: "Sean",
    role: "employee",
    company_id: companyId,
    position: "AI 어시스턴트",
    avatar_url: "/sean-avatar.png",
    status: "active",
    is_bot: true,
    presence: "online",
    language: "ko",
  });

  return authUser.user.id;
}

export async function getTeamMembers() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return [];

  // 봇이 없으면 자동 생성
  await ensureBotExists(profile.company_id);

  const { data: members } = await adminClient
    .from("profiles")
    .select("id, name, email, avatar_url, position, presence, last_seen_at, language, is_bot")
    .eq("company_id", profile.company_id)
    .eq("status", "active")
    .neq("id", user.id)
    .order("name");

  return members ?? [];
}

export async function getMessages(otherUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const adminClient = createAdminClient();

  // 내 언어 가져오기
  const { data: myProfile } = await adminClient
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .single();
  const myLang = myProfile?.language ?? "ko";

  // 메시지 로드
  const { data } = await adminClient
    .from("direct_messages")
    .select("id, sender_id, receiver_id, content, sender_language, is_read, created_at")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true })
    .limit(100);

  if (!data) return [];

  // 번역이 필요한 메시지 찾기 (상대방이 보낸 것 중 언어가 다른 것)
  const needsTranslation = data.filter(
    (m) => m.sender_id !== user.id && m.sender_language && m.sender_language !== myLang
  );

  if (needsTranslation.length === 0) {
    return data.map((m) => ({ ...m, translated_content: null }));
  }

  // 캐시된 번역 조회
  const msgIds = needsTranslation.map((m) => m.id);
  const { data: cached } = await adminClient
    .from("message_translations")
    .select("message_id, translated_content")
    .in("message_id", msgIds)
    .eq("target_language", myLang);

  const cacheMap = new Map(
    (cached ?? []).map((t) => [t.message_id, t.translated_content])
  );

  // 캐시에 없는 것만 번역
  const uncached = needsTranslation.filter((m) => !cacheMap.has(m.id));

  if (uncached.length > 0) {
    const translations = await Promise.all(
      uncached.map(async (m) => {
        const translated = await translateText(m.content, m.sender_language!, myLang);
        return { message_id: m.id, target_language: myLang, translated_content: translated };
      })
    );

    // 캐시에 저장
    if (translations.length > 0) {
      await adminClient.from("message_translations").upsert(translations, {
        onConflict: "message_id,target_language",
      });
    }

    for (const t of translations) {
      cacheMap.set(t.message_id, t.translated_content);
    }
  }

  return data.map((m) => ({
    ...m,
    translated_content:
      m.sender_id !== user.id && m.sender_language !== myLang
        ? cacheMap.get(m.id) ?? null
        : null,
  }));
}

export async function sendMessage(receiverId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, language")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return { error: "회사 정보가 없습니다" };

  const { error } = await adminClient.from("direct_messages").insert({
    company_id: profile.company_id,
    sender_id: user.id,
    receiver_id: receiverId,
    content: content.trim(),
    sender_language: profile.language ?? "ko",
  });

  if (error) return { error: "메시지 전송에 실패했습니다" };
  return { success: true };
}

// 클라이언트에서 봇에게 메시지를 보낸 뒤 호출 → AI 응답 생성 후 DM으로 저장
export async function requestBotReply(botId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const adminClient = createAdminClient();
  const { data: userProfile } = await adminClient
    .from("profiles")
    .select("company_id, language")
    .eq("id", user.id)
    .single();

  if (!userProfile?.company_id) return { error: "회사 정보 없음" };

  // 최근 대화 이력
  const { data: history } = await adminClient
    .from("direct_messages")
    .select("sender_id, content")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${botId}),and(sender_id.eq.${botId},receiver_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true })
    .limit(20);

  const conversationHistory = (history ?? []).map((m) => ({
    role: (m.sender_id === user.id ? "user" : "assistant") as "user" | "assistant",
    content: m.content,
  }));

  // AI 응답 생성
  const botReply = await generateBotResponse(content, conversationHistory);

  // 봇 메시지를 DM으로 저장 → Realtime으로 클라이언트에 전달됨
  await adminClient.from("direct_messages").insert({
    company_id: userProfile.company_id,
    sender_id: botId,
    receiver_id: user.id,
    content: botReply,
    sender_language: userProfile.language ?? "ko",
  });

  return { success: true };
}

export async function translateSingleMessage(
  messageId: string,
  content: string,
  fromLang: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    .from("message_translations")
    .select("translated_content")
    .eq("message_id", messageId)
    .eq("target_language", myLang)
    .single();

  if (cached) return { translated: cached.translated_content };

  // 번역
  const translated = await translateText(content, fromLang, myLang);

  // 캐시 저장
  await adminClient.from("message_translations").upsert(
    { message_id: messageId, target_language: myLang, translated_content: translated },
    { onConflict: "message_id,target_language" }
  );

  return { translated };
}

export async function markAsRead(otherUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const adminClient = createAdminClient();
  await adminClient
    .from("direct_messages")
    .update({ is_read: true })
    .eq("sender_id", otherUserId)
    .eq("receiver_id", user.id)
    .eq("is_read", false);
}

export async function getUnreadCounts() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("direct_messages")
    .select("sender_id")
    .eq("receiver_id", user.id)
    .eq("is_read", false);

  if (!data) return {};

  const counts: Record<string, number> = {};
  for (const msg of data) {
    counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
  }
  return counts;
}

export async function updatePresence(presence: "online" | "away" | "offline") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const adminClient = createAdminClient();
  await adminClient
    .from("profiles")
    .update({ presence, last_seen_at: new Date().toISOString() })
    .eq("id", user.id);
}
