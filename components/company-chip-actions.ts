"use server";

import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getCompanyChipData() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("name, role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;

  const [companyRes, countRes] = await Promise.all([
    adminClient.from("companies").select("*").eq("id", profile.company_id).single(),
    adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", profile.company_id).eq("status", "active").neq("is_bot", true),
  ]);

  if (!companyRes.data) return null;

  const c = companyRes.data;
  return {
    profile: {
      name: profile.name,
      role: profile.role as "admin" | "employee",
    },
    company: {
      name: c.name,
      foundedAt: c.founded_at ?? null,
      memberCount: countRes.count ?? 0,
      businessNumber: c.business_number ?? null,
      corpNumber: c.corp_number ?? null,
      phone: c.phone ?? null,
      address: c.address ?? null,
      logoUrl: c.logo_url ?? null,
    },
  };
}
