import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import LeaveSettingsView from "./leave-settings-view";

export default async function LeaveSettingsPage() {
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
    .from("company_leave_settings")
    .select("*")
    .eq("company_id", profile.company_id)
    .single();

  const isManager = profile.role === "manager" || profile.role === "admin";

  return <LeaveSettingsView current={settings} isManager={isManager} />;
}
