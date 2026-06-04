"use server";

import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { translateText } from "@/lib/translate";

export async function getPosts() {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return [];

  const adminClient = createAdminClient();

  const { data: myProfile } = await adminClient
    .from("profiles")
    .select("company_id, language")
    .eq("id", user.id)
    .single();
  if (!myProfile?.company_id) return [];

  const myLang = myProfile.language ?? "ko";

  const { data } = await adminClient
    .from("board_posts")
    .select("id, author_id, content, author_language, created_at, profiles!board_posts_author_id_fkey(name, avatar_url, position)")
    .eq("company_id", myProfile.company_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data) return [];

  // 공감 데이터 로드
  const allPostIds = data.map((p) => p.id);
  const { data: reactionsRaw } = allPostIds.length > 0
    ? await adminClient
        .from("board_reactions")
        .select("post_id, user_id")
        .in("post_id", allPostIds)
    : { data: [] };

  const reactionMap = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactionsRaw ?? []) {
    const prev = reactionMap.get(r.post_id) ?? { count: 0, mine: false };
    prev.count++;
    if (r.user_id === user.id) prev.mine = true;
    reactionMap.set(r.post_id, prev);
  }

  // 번역 필요한 게시글 찾기
  const needsTranslation = data.filter(
    (p) => p.author_id !== user.id && p.author_language && p.author_language !== myLang
  );

  if (needsTranslation.length === 0) {
    return data.map((p) => ({
      ...p,
      translated_content: null,
      reaction_count: reactionMap.get(p.id)?.count ?? 0,
      my_reaction: reactionMap.get(p.id)?.mine ?? false,
    }));
  }

  // 캐시 조회
  const postIds = needsTranslation.map((p) => p.id);
  const { data: cached } = await adminClient
    .from("board_post_translations")
    .select("post_id, translated_content")
    .in("post_id", postIds)
    .eq("target_language", myLang);

  const cacheMap = new Map(
    (cached ?? []).map((t) => [t.post_id, t.translated_content])
  );

  // 캐시에 없는 것만 번역
  const uncached = needsTranslation.filter((p) => !cacheMap.has(p.id));

  if (uncached.length > 0) {
    const translations = await Promise.all(
      uncached.map(async (p) => {
        const translated = await translateText(p.content, p.author_language!, myLang);
        return { post_id: p.id, target_language: myLang, translated_content: translated };
      })
    );

    if (translations.length > 0) {
      await adminClient.from("board_post_translations").upsert(translations, {
        onConflict: "post_id,target_language",
      });
    }

    for (const t of translations) {
      cacheMap.set(t.post_id, t.translated_content);
    }
  }

  return data.map((p) => ({
    ...p,
    translated_content:
      p.author_id !== user.id && p.author_language !== myLang
        ? cacheMap.get(p.id) ?? null
        : null,
    reaction_count: reactionMap.get(p.id)?.count ?? 0,
    my_reaction: reactionMap.get(p.id)?.mine ?? false,
  }));
}

export async function createPost(content: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, language")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return { error: "회사 정보가 없습니다" };

  const { error } = await adminClient.from("board_posts").insert({
    company_id: profile.company_id,
    author_id: user.id,
    content: content.trim(),
    author_language: profile.language ?? "ko",
  });

  if (error) return { error: "게시글 작성에 실패했습니다" };
  return { success: true };
}

export async function deletePost(postId: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("board_posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", user.id);

  if (error) return { error: "삭제에 실패했습니다" };
  return { success: true };
}

export async function toggleReaction(postId: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const adminClient = createAdminClient();

  // 이미 공감했는지 확인
  const { data: existing } = await adminClient
    .from("board_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    await adminClient.from("board_reactions").delete().eq("id", existing.id);
    return { toggled: false };
  } else {
    await adminClient.from("board_reactions").insert({ post_id: postId, user_id: user.id });
    return { toggled: true };
  }
}

export async function translateSinglePost(postId: string, content: string, fromLang: string) {
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

  // 캐시 확인
  const { data: cached } = await adminClient
    .from("board_post_translations")
    .select("translated_content")
    .eq("post_id", postId)
    .eq("target_language", myLang)
    .single();

  if (cached) return cached.translated_content;

  const translated = await translateText(content, fromLang, myLang);

  await adminClient.from("board_post_translations").upsert(
    { post_id: postId, target_language: myLang, translated_content: translated },
    { onConflict: "post_id,target_language" }
  );

  return translated;
}
