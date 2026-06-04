import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import LeaveSettingsView from "./leave-settings-view";

export default async function LeaveSettingsPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  const adminClient = createAdminClient();

  const { data: settings } = await adminClient
    .from("company_leave_settings")
    .select("*")
    .eq("company_id", profile.company_id)
    .single();

  const isManager = profile.role === "admin";

  return <LeaveSettingsView current={settings} isManager={isManager} />;
}
