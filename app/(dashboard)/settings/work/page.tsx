import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import WorkSettingsView from "./work-settings-view";

export default async function WorkSettingsPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  const adminClient = createAdminClient();

  const { data: settings } = await adminClient
    .from("company_work_settings")
    .select("work_type, fixed_start, fixed_end, flexible_start, flexible_end, required_hours, lunch_start, lunch_duration, core_time_enabled, core_time_start, core_time_end")
    .eq("company_id", profile.company_id)
    .single();

  return (
    <WorkSettingsView
      current={settings}
      isManager={profile.role === "admin"}
    />
  );
}
