import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const adminClient = createAdminClient();
      const userEmail = data.user.email!.toLowerCase();

      const { data: existing } = await adminClient
        .from("profiles")
        .select("id, company_id, status")
        .eq("id", data.user.id)
        .single();

      // 초대 확인 (이메일 매칭)
      const { data: invitation } = await adminClient
        .from("invitations")
        .select("id, company_id")
        .eq("email", userEmail)
        .eq("status", "pending")
        .single();

      if (!existing) {
        // 신규 유저
        if (invitation) {
          // 초대받은 유저 → 바로 회사 연결 (active)
          await adminClient.from("profiles").insert({
            id: data.user.id,
            email: userEmail,
            name: data.user.user_metadata.full_name || userEmail.split("@")[0],
            role: "employee",
            company_id: invitation.company_id,
            avatar_url: data.user.user_metadata.avatar_url || null,
            status: "active",
          });

          // 초대 상태 업데이트
          await adminClient
            .from("invitations")
            .update({ status: "accepted" })
            .eq("id", invitation.id);

          return NextResponse.redirect(`${origin}/attendance`);
        }

        // 초대 없이 가입 → 온보딩
        await adminClient.from("profiles").insert({
          id: data.user.id,
          email: userEmail,
          name: data.user.user_metadata.full_name || userEmail.split("@")[0],
          role: "employee",
          avatar_url: data.user.user_metadata.avatar_url || null,
        });
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      // 기존 유저인데 회사 없음 + 초대 있음
      if (!existing.company_id && invitation) {
        await adminClient
          .from("profiles")
          .update({ company_id: invitation.company_id, role: "employee", status: "active" })
          .eq("id", data.user.id);

        await adminClient
          .from("invitations")
          .update({ status: "accepted" })
          .eq("id", invitation.id);

        return NextResponse.redirect(`${origin}/attendance`);
      }

      // 기존 유저, 회사 없음, 초대 없음
      if (!existing.company_id) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      // pending 상태면 대기 페이지로
      if (existing.status === "pending") {
        return NextResponse.redirect(`${origin}/pending`);
      }

      return NextResponse.redirect(`${origin}/attendance`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
