"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidCidr } from "@/lib/ip";

// 관리자 + 회사 검증 공통 헬퍼
async function requireAdmin() {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" as const };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || !profile.company_id) {
    return { error: "권한이 없습니다" as const };
  }
  return { adminClient, companyId: profile.company_id as string };
}

// "203.0.113.0/24, 1.2.3.4\n2001:db8::/32" → 정규화된 CIDR 배열. 잘못된 값이 있으면 error.
function parseCidrs(raw: string): { cidrs: string[] } | { error: string } {
  const tokens = raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const invalid = tokens.filter((t) => !isValidCidr(t));
  if (invalid.length > 0) {
    return { error: `잘못된 IP/대역: ${invalid.join(", ")}` };
  }
  return { cidrs: tokens };
}

export async function createIpPolicy(name: string, cidrsRaw: string) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const trimmedName = name.trim();
  if (!trimmedName) return { error: "정책 이름을 입력해주세요" };

  const parsed = parseCidrs(cidrsRaw);
  if ("error" in parsed) return parsed;

  const { error } = await ctx.adminClient.from("ip_policies").insert({
    company_id: ctx.companyId,
    name: trimmedName,
    cidrs: parsed.cidrs,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings/ip-policies");
  return { success: true };
}

export async function updateIpPolicy(id: string, name: string, cidrsRaw: string) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const trimmedName = name.trim();
  if (!trimmedName) return { error: "정책 이름을 입력해주세요" };

  const parsed = parseCidrs(cidrsRaw);
  if ("error" in parsed) return parsed;

  const { error } = await ctx.adminClient
    .from("ip_policies")
    .update({ name: trimmedName, cidrs: parsed.cidrs })
    .eq("id", id)
    .eq("company_id", ctx.companyId);
  if (error) return { error: error.message };

  revalidatePath("/settings/ip-policies");
  return { success: true };
}

export async function deleteIpPolicy(id: string) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  // 이 정책을 쓰던 유저들은 제한 해제(null)로 정리한 뒤 삭제한다.
  await ctx.adminClient
    .from("profiles")
    .update({ ip_policy_id: null })
    .eq("ip_policy_id", id)
    .eq("company_id", ctx.companyId);

  const { error } = await ctx.adminClient
    .from("ip_policies")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId);
  if (error) return { error: error.message };

  revalidatePath("/settings/ip-policies");
  revalidatePath("/settings/members");
  return { success: true };
}

// 멤버 상세 모달에서 사용: 회사의 정책 목록
export async function getIpPolicies() {
  const ctx = await requireAdmin();
  if ("error" in ctx) return [];

  const { data } = await ctx.adminClient
    .from("ip_policies")
    .select("id, name, cidrs")
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    cidrs: (p.cidrs as string[]) ?? [],
  }));
}

// 멤버 상세 모달에서 사용: 유저에게 정책 할당(또는 null = 제한 해제)
export async function assignIpPolicy(memberId: string, policyId: string | null) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  // 대상이 같은 회사 멤버인지 확인
  const { data: target } = await ctx.adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", memberId)
    .single();
  if (!target || target.company_id !== ctx.companyId) {
    return { error: "같은 회사의 멤버가 아닙니다" };
  }

  // 정책을 지정한 경우, 그 정책이 같은 회사 소속인지 확인
  if (policyId) {
    const { data: policy } = await ctx.adminClient
      .from("ip_policies")
      .select("id")
      .eq("id", policyId)
      .eq("company_id", ctx.companyId)
      .single();
    if (!policy) return { error: "존재하지 않는 정책입니다" };
  }

  const { error } = await ctx.adminClient
    .from("profiles")
    .update({ ip_policy_id: policyId })
    .eq("id", memberId);
  if (error) return { error: error.message };

  revalidatePath("/settings/members");
  return { success: true };
}
