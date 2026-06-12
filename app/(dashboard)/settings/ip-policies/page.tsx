import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import { getClientIp } from "@/lib/ip";
import IpPoliciesView from "./ip-policies-view";

export default async function IpPoliciesPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  // 관리자만 접근
  if (profile.role !== "admin") return null;

  const adminClient = createAdminClient();

  const { data: policies } = await adminClient
    .from("ip_policies")
    .select("id, name, cidrs")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: true });

  // 사용 중 멤버 수 집계 (정책별)
  const { data: assigned } = await adminClient
    .from("profiles")
    .select("ip_policy_id")
    .eq("company_id", profile.company_id)
    .not("ip_policy_id", "is", null);

  const usageCount: Record<string, number> = {};
  for (const row of assigned ?? []) {
    const id = row.ip_policy_id as string;
    usageCount[id] = (usageCount[id] ?? 0) + 1;
  }

  const currentIp = getClientIp(await headers());

  return (
    <IpPoliciesView
      policies={(policies ?? []).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        cidrs: (p.cidrs as string[]) ?? [],
        memberCount: usageCount[p.id as string] ?? 0,
      }))}
      currentIp={currentIp}
    />
  );
}
