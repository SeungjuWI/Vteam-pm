import { cache } from "react";
import { createClient } from "./server";
import { createAdminClient } from "./admin";

export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, status, role, language, name, position, avatar_url")
    .eq("id", user.id)
    .single();

  return profile;
});
