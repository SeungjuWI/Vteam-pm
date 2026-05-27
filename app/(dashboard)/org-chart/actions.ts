"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface OrgMember {
  id: string;
  name: string;
  position: string;
  role: string;
  avatarUrl: string;
  reportsTo: string | null;
}

export async function getOrgChartData(): Promise<OrgMember[] | null> {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;

  const { data: members } = await adminClient
    .from("profiles")
    .select("id, name, position, role, avatar_url, reports_to")
    .eq("company_id", profile.company_id)
    .eq("status", "active")
    .order("name");

  return (
    members?.map((m) => ({
      id: m.id as string,
      name: m.name as string,
      position: (m.position as string) ?? "",
      role: m.role as string,
      avatarUrl: (m.avatar_url as string) ?? "",
      reportsTo: (m.reports_to as string) ?? null,
    })) ?? []
  );
}

export async function updateReportsTo(memberId: string, reportsTo: string | null) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (
    !profile?.company_id ||
    (profile.role !== "manager" && profile.role !== "admin")
  ) {
    return { error: "권한이 없습니다" };
  }

  // 같은 회사인지 확인
  const { data: target } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", memberId)
    .single();

  if (!target || target.company_id !== profile.company_id) {
    return { error: "같은 회사의 멤버가 아닙니다" };
  }

  // 자기 자신에게 보고할 수 없음
  if (reportsTo === memberId) {
    return { error: "자기 자신에게 보고할 수 없습니다" };
  }

  // 순환 참조 방지
  if (reportsTo) {
    let current = reportsTo;
    const visited = new Set<string>([memberId]);
    while (current) {
      if (visited.has(current)) {
        return { error: "순환 참조가 발생합니다" };
      }
      visited.add(current);
      const { data: parent } = await adminClient
        .from("profiles")
        .select("reports_to")
        .eq("id", current)
        .single();
      current = (parent?.reports_to as string) ?? "";
      if (!current) break;
    }
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ reports_to: reportsTo })
    .eq("id", memberId);

  if (error) return { error: error.message };

  revalidatePath("/org-chart");
  return { success: true };
}
