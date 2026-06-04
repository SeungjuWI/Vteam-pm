"use server";

import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { translateText } from "@/lib/translate";

// 요청자가 해당 프로젝트(=회사)에 접근 가능한지 확인하고 프로필을 반환
async function getAccessibleProfile(projectId: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, language")
    .eq("id", user.id)
    .single();
  if (!profile?.company_id) return null;

  const { data: project } = await adminClient
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("company_id", profile.company_id)
    .single();
  if (!project) return null;

  return { userId: user.id, companyId: profile.company_id, lang: profile.language ?? "ko", adminClient };
}

// ---------- 안읽음 ----------

export async function getUnreadDiscussionCount(projectId: string) {
  const ctx = await getAccessibleProfile(projectId);
  if (!ctx) return 0;
  const { userId, adminClient } = ctx;

  const { data: readRow } = await adminClient
    .from("project_discussion_reads")
    .select("last_read_at")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .single();
  const lastRead = readRow?.last_read_at ?? "1970-01-01T00:00:00Z";

  const [postsRes, repliesRes] = await Promise.all([
    adminClient
      .from("project_posts")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .neq("author_id", userId)
      .gt("created_at", lastRead),
    adminClient
      .from("project_post_replies")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .neq("author_id", userId)
      .gt("created_at", lastRead),
  ]);

  return (postsRes.count ?? 0) + (repliesRes.count ?? 0);
}

export async function markDiscussionRead(projectId: string) {
  const ctx = await getAccessibleProfile(projectId);
  if (!ctx) return { error: "권한이 없습니다" };

  await ctx.adminClient.from("project_discussion_reads").upsert(
    { project_id: projectId, user_id: ctx.userId, last_read_at: new Date().toISOString() },
    { onConflict: "project_id,user_id" }
  );
  return { success: true };
}

// ---------- 글 ----------

export async function getProjectPosts(projectId: string) {
  const ctx = await getAccessibleProfile(projectId);
  if (!ctx) return [];
  const { userId, lang: myLang, adminClient } = ctx;

  const { data } = await adminClient
    .from("project_posts")
    .select("id, author_id, content, author_language, created_at, profiles!project_posts_author_id_fkey(name, avatar_url, position)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data || data.length === 0) return [];

  const postIds = data.map((p) => p.id);

  // 공감 + 댓글 수 병렬 조회
  const [reactionsRes, repliesRes] = await Promise.all([
    adminClient.from("project_post_reactions").select("post_id, user_id").in("post_id", postIds),
    adminClient.from("project_post_replies").select("post_id").in("post_id", postIds),
  ]);

  const reactionMap = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactionsRes.data ?? []) {
    const prev = reactionMap.get(r.post_id) ?? { count: 0, mine: false };
    prev.count++;
    if (r.user_id === userId) prev.mine = true;
    reactionMap.set(r.post_id, prev);
  }

  const replyCountMap = new Map<string, number>();
  for (const r of repliesRes.data ?? []) {
    replyCountMap.set(r.post_id, (replyCountMap.get(r.post_id) ?? 0) + 1);
  }

  // 번역 (캐시 우선)
  const needsTranslation = data.filter(
    (p) => p.author_id !== userId && p.author_language && p.author_language !== myLang
  );

  const cacheMap = new Map<string, string>();
  if (needsTranslation.length > 0) {
    const { data: cached } = await adminClient
      .from("project_post_translations")
      .select("post_id, translated_content")
      .in("post_id", needsTranslation.map((p) => p.id))
      .eq("target_language", myLang);

    for (const t of cached ?? []) cacheMap.set(t.post_id, t.translated_content);

    const uncached = needsTranslation.filter((p) => !cacheMap.has(p.id));
    if (uncached.length > 0) {
      const translations = await Promise.all(
        uncached.map(async (p) => ({
          post_id: p.id,
          target_language: myLang,
          translated_content: await translateText(p.content, p.author_language!, myLang),
        }))
      );
      await adminClient
        .from("project_post_translations")
        .upsert(translations, { onConflict: "post_id,target_language" });
      for (const t of translations) cacheMap.set(t.post_id, t.translated_content);
    }
  }

  return data.map((p) => ({
    ...p,
    translated_content:
      p.author_id !== userId && p.author_language && p.author_language !== myLang
        ? cacheMap.get(p.id) ?? null
        : null,
    reaction_count: reactionMap.get(p.id)?.count ?? 0,
    my_reaction: reactionMap.get(p.id)?.mine ?? false,
    reply_count: replyCountMap.get(p.id) ?? 0,
  }));
}

export async function createProjectPost(projectId: string, content: string) {
  const ctx = await getAccessibleProfile(projectId);
  if (!ctx) return { error: "권한이 없습니다" };

  const trimmed = content.trim();
  if (!trimmed) return { error: "내용을 입력하세요" };

  const { error } = await ctx.adminClient.from("project_posts").insert({
    project_id: projectId,
    author_id: ctx.userId,
    content: trimmed,
    author_language: ctx.lang,
  });

  if (error) return { error: "글 작성에 실패했습니다" };
  return { success: true };
}

export async function deleteProjectPost(postId: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("project_posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", user.id);

  if (error) return { error: "삭제에 실패했습니다" };
  return { success: true };
}

export async function toggleProjectPostReaction(postId: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const adminClient = createAdminClient();
  const { data: existing } = await adminClient
    .from("project_post_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    await adminClient.from("project_post_reactions").delete().eq("id", existing.id);
    return { toggled: false };
  }
  await adminClient.from("project_post_reactions").insert({ post_id: postId, user_id: user.id });
  return { toggled: true };
}

// ---------- 스레드 답글 ----------

export async function getProjectReplies(postId: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return [];

  const adminClient = createAdminClient();
  const { data: myProfile } = await adminClient
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .single();
  const myLang = myProfile?.language ?? "ko";

  const { data } = await adminClient
    .from("project_post_replies")
    .select("id, author_id, content, author_language, created_at, profiles!project_post_replies_author_id_fkey(name, avatar_url, position)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (!data || data.length === 0) return [];

  const needsTranslation = data.filter(
    (r) => r.author_id !== user.id && r.author_language && r.author_language !== myLang
  );

  const cacheMap = new Map<string, string>();
  if (needsTranslation.length > 0) {
    const { data: cached } = await adminClient
      .from("project_reply_translations")
      .select("reply_id, translated_content")
      .in("reply_id", needsTranslation.map((r) => r.id))
      .eq("target_language", myLang);

    for (const t of cached ?? []) cacheMap.set(t.reply_id, t.translated_content);

    const uncached = needsTranslation.filter((r) => !cacheMap.has(r.id));
    if (uncached.length > 0) {
      const translations = await Promise.all(
        uncached.map(async (r) => ({
          reply_id: r.id,
          target_language: myLang,
          translated_content: await translateText(r.content, r.author_language!, myLang),
        }))
      );
      await adminClient
        .from("project_reply_translations")
        .upsert(translations, { onConflict: "reply_id,target_language" });
      for (const t of translations) cacheMap.set(t.reply_id, t.translated_content);
    }
  }

  return data.map((r) => ({
    ...r,
    translated_content:
      r.author_id !== user.id && r.author_language && r.author_language !== myLang
        ? cacheMap.get(r.id) ?? null
        : null,
  }));
}

export async function createProjectReply(projectId: string, postId: string, content: string) {
  const ctx = await getAccessibleProfile(projectId);
  if (!ctx) return { error: "권한이 없습니다" };

  const trimmed = content.trim();
  if (!trimmed) return { error: "내용을 입력하세요" };

  // 글이 실제로 이 프로젝트에 속하는지 확인
  const { data: post } = await ctx.adminClient
    .from("project_posts")
    .select("id")
    .eq("id", postId)
    .eq("project_id", projectId)
    .single();
  if (!post) return { error: "글을 찾을 수 없습니다" };

  const { error } = await ctx.adminClient.from("project_post_replies").insert({
    post_id: postId,
    project_id: projectId,
    author_id: ctx.userId,
    content: trimmed,
    author_language: ctx.lang,
  });

  if (error) return { error: "댓글 작성에 실패했습니다" };
  return { success: true };
}

export async function deleteProjectReply(replyId: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("project_post_replies")
    .delete()
    .eq("id", replyId)
    .eq("author_id", user.id);

  if (error) return { error: "삭제에 실패했습니다" };
  return { success: true };
}

// ---------- realtime용 단건 번역 ----------

export async function translateSingleProjectPost(postId: string, content: string, fromLang: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: myProfile } = await adminClient
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .single();
  const myLang = myProfile?.language ?? "ko";
  if (fromLang === myLang) return null;

  const { data: cached } = await adminClient
    .from("project_post_translations")
    .select("translated_content")
    .eq("post_id", postId)
    .eq("target_language", myLang)
    .single();
  if (cached) return cached.translated_content;

  const translated = await translateText(content, fromLang, myLang);
  await adminClient
    .from("project_post_translations")
    .upsert(
      { post_id: postId, target_language: myLang, translated_content: translated },
      { onConflict: "post_id,target_language" }
    );
  return translated;
}

export async function translateSingleProjectReply(replyId: string, content: string, fromLang: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: myProfile } = await adminClient
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .single();
  const myLang = myProfile?.language ?? "ko";
  if (fromLang === myLang) return null;

  const { data: cached } = await adminClient
    .from("project_reply_translations")
    .select("translated_content")
    .eq("reply_id", replyId)
    .eq("target_language", myLang)
    .single();
  if (cached) return cached.translated_content;

  const translated = await translateText(content, fromLang, myLang);
  await adminClient
    .from("project_reply_translations")
    .upsert(
      { reply_id: replyId, target_language: myLang, translated_content: translated },
      { onConflict: "reply_id,target_language" }
    );
  return translated;
}
