import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CompanyInfoView from "./company-info-view";

export default async function CompanySettingsPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;

  const { data: company } = await adminClient
    .from("companies")
    .select("name, created_at, founded_at, business_number, corp_number, phone, address, logo_url")
    .eq("id", profile.company_id)
    .single();

  const { count } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id)
    .eq("status", "active");

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
