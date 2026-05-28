"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { data: members } = await adminClient
    .from("profiles")
    .select("id, name, email, avatar_url, position, presence, last_seen_at")
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
  const { data } = await adminClient
    .from("direct_messages")
    .select("id, sender_id, receiver_id, content, is_read, created_at")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true })
    .limit(100);

  return data ?? [];
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
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return { error: "회사 정보가 없습니다" };

  const { error } = await adminClient.from("direct_messages").insert({
    company_id: profile.company_id,
    sender_id: user.id,
    receiver_id: receiverId,
    content: content.trim(),
  });

  if (error) return { error: "메시지 전송에 실패했습니다" };
  return { success: true };
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
