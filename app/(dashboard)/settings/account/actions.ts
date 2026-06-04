"use server";

import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function updateLanguage(language: string) {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({ language })
    .eq("id", user.id);

  if (error) return { error: "저장에 실패했습니다" };

  revalidatePath("/settings/account");
  return { success: true };
}

export async function updateUiLanguage(lang: string) {
  const cookieStore = await cookies();
  cookieStore.set("vteam-ui-lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  return { success: true };
}
