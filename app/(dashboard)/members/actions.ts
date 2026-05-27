"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function inviteMember(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "manager") return { error: "권한이 없습니다" };

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) return { error: "이메일을 입력해주세요" };

  // 이미 초대된 이메일인지 확인
  const { data: existing } = await adminClient
    .from("invitations")
    .select("id")
    .eq("email", email)
    .eq("company_id", profile.company_id)
    .eq("status", "pending")
    .single();

  if (existing) return { error: "이미 초대된 이메일입니다" };

  // 이미 가입된 멤버인지 확인
  const { data: existingMember } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .eq("company_id", profile.company_id)
    .single();

  if (existingMember) return { error: "이미 팀에 소속된 멤버입니다" };

  const { error: inviteError } = await adminClient
    .from("invitations")
    .insert({
      company_id: profile.company_id,
      email,
      invited_by: user.id,
    });

  if (inviteError) return { error: inviteError.message };

  revalidatePath("/members");
  return { success: true };
}

export async function approveMember(memberId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "manager") return { error: "권한이 없습니다" };

  const { data: target } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", memberId)
    .single();

  if (target?.company_id !== profile.company_id) return { error: "같은 회사의 멤버가 아닙니다" };

  await adminClient
    .from("profiles")
    .update({ status: "active" })
    .eq("id", memberId);

  revalidatePath("/members");
}

export async function rejectMember(memberId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "manager") return { error: "권한이 없습니다" };

  const { data: target } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", memberId)
    .single();

  if (target?.company_id !== profile.company_id) return { error: "같은 회사의 멤버가 아닙니다" };

  await adminClient
    .from("profiles")
    .update({ company_id: null, status: "inactive" })
    .eq("id", memberId);

  revalidatePath("/members");
}

export async function cancelInvitation(invitationId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  await adminClient
    .from("invitations")
    .update({ status: "expired" })
    .eq("id", invitationId);

  revalidatePath("/members");
}
