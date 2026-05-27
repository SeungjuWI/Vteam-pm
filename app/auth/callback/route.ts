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
      // profiles에 없으면 자동 생성 (Google 최초 로그인)
      const adminClient = createAdminClient();
      const { data: existing } = await adminClient
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existing) {
        await adminClient.from("profiles").insert({
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata.full_name || data.user.email!.split("@")[0],
          role: "manager",
        });
      }

      return NextResponse.redirect(`${origin}/attendance`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
