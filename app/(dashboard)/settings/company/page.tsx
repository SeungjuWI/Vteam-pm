import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import CompanyInfoView from "./company-info-view";

export default async function CompanySettingsPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  const adminClient = createAdminClient();

  const { data: company } = await adminClient
    .from("companies")
    .select("name, created_at, founded_at, business_number, corp_number, phone, address, logo_url")
    .eq("id", profile.company_id)
    .single();

  const { count } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id)
    .eq("status", "active")
    .neq("is_bot", true);

  if (!company) return null;

  const isEditable = profile.role === "admin" || profile.role === "manager";

  return (
    <CompanyInfoView
      data={{
        name: company.name,
        foundedAt: company.founded_at ?? "",
        businessNumber: company.business_number ?? "",
        corpNumber: company.corp_number ?? "",
        phone: company.phone ?? "",
        address: company.address ?? "",
        logoUrl: company.logo_url ?? "",
        createdAt: company.created_at,
        memberCount: count || 0,
      }}
      isEditable={isEditable}
    />
  );
}
