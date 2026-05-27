import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import LeaveSettingsView from "./leave-settings-view";
import BalanceManager from "../../leaves/balance-manager";

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

  const year = new Date().getFullYear();

  const { data: settings } = await adminClient
    .from("company_leave_settings")
    .select("auto_grant, default_annual_days, grant_basis")
    .eq("company_id", profile.company_id)
    .single();

  const isManager = profile.role === "manager";

  // 멤버별 연차 현황 (관리자만)
  let memberBalances: { id: string; name: string; email: string; total: number; used: number }[] = [];
  if (isManager) {
    const { data: members } = await adminClient
      .from("profiles")
      .select("id, name, email")
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .order("name");

    const { data: balances } = await adminClient
      .from("leave_balances")
      .select("employee_id, total, used")
      .eq("company_id", profile.company_id)
      .eq("year", year);

    const balMap = new Map((balances || []).map((b) => [b.employee_id, b]));

    memberBalances = (members || []).map((m) => {
      const bal = balMap.get(m.id);
      return {
        id: m.id,
        name: m.name,
        email: m.email,
        total: Number(bal?.total ?? 0),
        used: Number(bal?.used ?? 0),
      };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <LeaveSettingsView current={settings} isManager={isManager} />
      {isManager && <BalanceManager members={memberBalances} />}
    </div>
  );
}
