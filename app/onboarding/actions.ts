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

  const language = (formData.get("language") as string) || "ko";

  // 초대받은 이메일이면 새 회사를 만들지 않고 초대된 회사로 연결한다.
  // (페이지 진입 후 초대가 생긴 경우 온보딩 폼에서 그대로 제출해도 새 워크스페이스가 생기는 걸 막는다)
  const userEmail = user.email?.toLowerCase();
  if (userEmail) {
    const { data: invitation } = await adminClient
      .from("invitations")
      .select("company_id")
      .eq("email", userEmail)
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invitation) {
      const { data: updated, error: joinError } = await adminClient
        .from("profiles")
        .update({
          name: name.trim(),
          role: "employee",
          company_id: invitation.company_id,
          status: "setup",
          language,
        })
        .eq("id", user.id)
        .select("id");

      if (joinError) return { error: joinError.message };

      if (!updated?.length) {
        const { error: insertError } = await adminClient.from("profiles").insert({
          id: user.id,
          email: userEmail,
          name: name.trim(),
          role: "employee",
          company_id: invitation.company_id,
          status: "setup",
          language,
        });
        if (insertError) return { error: insertError.message };
      }

      redirect("/welcome");
    }
  }

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

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ name: name.trim(), role: "admin", company_id: company.id, status: "active", language })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  redirect("/attendance");
}
