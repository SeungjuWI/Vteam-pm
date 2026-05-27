"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getProfileMenuData() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("name, role, position, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    name: profile.name as string,
    role: profile.role as "admin" | "manager" | "employee",
    position: (profile.position as string) ?? "",
    avatarUrl: (profile.avatar_url as string) ?? "",
    email: user.email ?? "",
  };
}
