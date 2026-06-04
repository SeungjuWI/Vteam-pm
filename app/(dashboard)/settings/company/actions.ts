"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";

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
