import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/auth-cache";
import ProfileView from "./profile-view";

export default async function ProfileSettingsPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("name, email, role, position, avatar_url, language")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return (
    <ProfileView
      data={{
        name: profile.name,
        email: profile.email,
        role: profile.role,
        position: profile.position ?? "",
        avatarUrl: profile.avatar_url ?? "",
        language: profile.language ?? "ko",
      }}
    />
  );
}
