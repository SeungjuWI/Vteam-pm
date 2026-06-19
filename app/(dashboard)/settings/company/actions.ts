"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyOverdue, buildDigestText, postToSlack } from "@/lib/slack";

// 관리자 본인 + company_id 확인 헬퍼
async function requireAdmin() {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" as const };
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") return { error: "권한이 없습니다" as const };
  return { adminClient, companyId: profile.company_id as string };
}

// 슬랙 지연업무 알림 설정 저장
export async function saveSlackSettings(formData: FormData) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const webhook = (formData.get("webhookUrl") as string)?.trim() || null;
  const enabled = formData.get("enabled") === "on" || formData.get("enabled") === "true";

  if (enabled && !webhook) return { error: "알림을 켜려면 슬랙 웹훅 주소가 필요합니다" };
  if (webhook && !/^https:\/\/hooks\.slack\.com\//.test(webhook)) {
    return { error: "올바른 슬랙 Incoming Webhook 주소가 아닙니다 (https://hooks.slack.com/... )" };
  }

  const { error } = await ctx.adminClient
    .from("companies")
    .update({ slack_webhook_url: webhook, slack_digest_enabled: enabled })
    .eq("id", ctx.companyId);

  if (error) return { error: "저장에 실패했습니다" };
  revalidatePath("/settings/company");
  return { success: true };
}

// 지금 바로 테스트 전송 (현재 지연 업무로)
export async function sendSlackTest() {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };

  const { data: company } = await ctx.adminClient
    .from("companies")
    .select("name, slack_webhook_url")
    .eq("id", ctx.companyId)
    .single();

  const webhook = (company?.slack_webhook_url as string)?.trim();
  if (!webhook) return { error: "먼저 슬랙 웹훅 주소를 저장해주세요" };

  const items = await getCompanyOverdue(ctx.adminClient, ctx.companyId);
  const text = items.length > 0
    ? buildDigestText(company!.name as string, items)
    : `:white_check_mark: *${company!.name}* — 지금은 지연된 업무가 없어요. (테스트 메시지)`;

  const ok = await postToSlack(webhook, text);
  if (!ok) return { error: "전송 실패 — 웹훅 주소를 다시 확인해주세요" };
  return { success: true, count: items.length };
}

export async function saveCompanyInfo(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "권한이 없습니다" };
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "회사명은 필수입니다" };

  // 로고 업로드 처리
  let logoUrl: string | null | undefined;
  const logoFile = formData.get("logo") as File | null;
  const removeLogo = formData.get("removeLogo");

  if (logoFile && logoFile.size > 0) {
    if (logoFile.size > 2 * 1024 * 1024) {
      return { error: "로고 파일은 2MB 이하만 가능합니다" };
    }

    const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `${profile.company_id}/logo_${Date.now()}.${ext}`;

    // 기존 로고 삭제
    const { data: existing } = await adminClient.storage
      .from("company-logos")
      .list(profile.company_id);
    if (existing && existing.length > 0) {
      await adminClient.storage
        .from("company-logos")
        .remove(existing.map((f) => `${profile.company_id}/${f.name}`));
    }

    const { error: uploadError } = await adminClient.storage
      .from("company-logos")
      .upload(filePath, logoFile, { upsert: true });

    if (uploadError) return { error: "로고 업로드에 실패했습니다" };

    const { data: urlData } = adminClient.storage
      .from("company-logos")
      .getPublicUrl(filePath);

    logoUrl = urlData.publicUrl;
  } else if (removeLogo === "true") {
    // 로고 삭제
    const { data: existing } = await adminClient.storage
      .from("company-logos")
      .list(profile.company_id);
    if (existing && existing.length > 0) {
      await adminClient.storage
        .from("company-logos")
        .remove(existing.map((f) => `${profile.company_id}/${f.name}`));
    }
    logoUrl = null;
  }

  const payload: Record<string, unknown> = {
    name,
    founded_at: (formData.get("foundedAt") as string)?.trim() || null,
    business_number: (formData.get("businessNumber") as string)?.trim() || null,
    corp_number: (formData.get("corpNumber") as string)?.trim() || null,
    phone: (formData.get("phone") as string)?.trim() || null,
    address: (formData.get("address") as string)?.trim() || null,
  };

  if (logoUrl !== undefined) {
    payload.logo_url = logoUrl;
  }

  const { error } = await adminClient
    .from("companies")
    .update(payload)
    .eq("id", profile.company_id);

  if (error) return { error: "저장에 실패했습니다" };

  revalidatePath("/settings/company");
  return { success: true };
}
