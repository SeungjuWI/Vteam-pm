"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createCompany(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const name = formData.get("name") as string;
  if (!name?.trim()) return { error: "이름을 입력해주세요" };

  const companyName = formData.get("companyName") as string;
  if (!companyName?.trim()) return { error: "회사명을 입력해주세요" };

  const { data: company, error: companyError } = await adminClient
    .from("companies")
    .insert({
      name: companyName.trim(),
      created_by: user.id,
      invite_code: generateInviteCode(),
    })
    .select()
    .single();

  if (companyError) return { error: companyError.message };

  const language = (formData.get("language") as string) || "ko";

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ name: name.trim(), role: "admin", company_id: company.id, status: "active", language })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  redirect("/attendance");
}
