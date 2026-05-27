import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import WorkSettingsView from "./work-settings-view";

export default async function WorkSettingsPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;

  const { data: settings } = await adminClient
    .from("company_work_settings")
    .select("work_type, fixed_start, fixed_end, flexible_start, flexible_end, required_hours, lunch_start, lunch_duration, core_time_enabled, core_time_start, core_time_end")
    .eq("company_id", profile.company_id)
    .single();

  return (
    <WorkSettingsView
      current={settings}
      isManager={profile.role === "manager"}
    />
  );
}
