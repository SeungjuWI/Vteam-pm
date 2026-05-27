import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ProfileView from "./profile-view";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("name, email, role, position, avatar_url")
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
      }}
    />
  );
}
