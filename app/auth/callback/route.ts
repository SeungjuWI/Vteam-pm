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

      // 초대 확인 (pending 또는 이미 accepted 됐지만 setup 미완료인 경우 대응)
      const { data: invitation } = await adminClient
        .from("invitations")
        .select("id, company_id, status")
        .eq("email", userEmail)
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!existing) {
        // 신규 유저
        if (invitation) {
          const { error: insertError } = await adminClient.from("profiles").insert({
            id: data.user.id,
            email: userEmail,
            name: data.user.user_metadata.full_name || userEmail.split("@")[0],
            role: "employee",
            company_id: invitation.company_id,
            avatar_url: data.user.user_metadata.avatar_url || null,
            status: "setup",
          });

          if (insertError) {
            console.error("Profile insert failed:", insertError);
            return NextResponse.redirect(`${origin}/onboarding`);
          }

          return NextResponse.redirect(`${origin}/welcome`);
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
          .update({ company_id: invitation.company_id, role: "employee", status: "setup" })
          .eq("id", data.user.id);

        return NextResponse.redirect(`${origin}/welcome`);
      }

      // 기존 유저, 회사 없음, 초대 없음
      if (!existing.company_id) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      // setup 상태면 웰컴 페이지로
      if (existing.status === "setup") {
        return NextResponse.redirect(`${origin}/welcome`);
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
