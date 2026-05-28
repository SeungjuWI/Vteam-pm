"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function updateLanguage(language: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
