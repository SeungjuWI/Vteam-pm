"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// 프로젝트 멤버(또는 admin)만 OKR을 편집할 수 있음.
// 통과 시 admin 클라이언트와 프로필 반환, 실패 시 에러 문자열 반환.
async function authorize(
  projectId: string,
): Promise<{ adminClient: SupabaseClient; userId: string } | { error: string }> {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.company_id) return { error: "권한이 없습니다" };

  // 프로젝트가 같은 회사 소속인지 확인
  const { data: project } = await adminClient
    .from("projects")
    .select("company_id")
    .eq("id", projectId)
    .single();
  if (!project || project.company_id !== profile.company_id) {
    return { error: "권한이 없습니다" };
  }

  // admin이 아니면 프로젝트 멤버여야 함
  if (profile.role !== "admin") {
    const { data: membership } = await adminClient
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("member_id", user.id)
      .maybeSingle();
    if (!membership) return { error: "프로젝트 멤버만 OKR을 편집할 수 있습니다" };
  }

  return { adminClient, userId: user.id };
}

export async function createObjective(
  projectId: string,
  period: string,
  title: string,
  description: string,
  ownerId: string | null,
  keyResults: string[] = [],
) {
  const auth = await authorize(projectId);
  if ("error" in auth) return auth;
  const { adminClient, userId } = auth;

  if (!title.trim()) return { error: "목표를 입력해주세요" };
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "기간이 올바르지 않습니다" };

  const { data: project } = await adminClient
    .from("projects")
    .select("company_id")
    .eq("id", projectId)
    .single();
  if (!project) return { error: "권한이 없습니다" };

  const { data: objective, error } = await adminClient
    .from("okr_objectives")
    .insert({
      project_id: projectId,
      company_id: project.company_id,
      period,
      title: title.trim(),
      description: description.trim() || null,
      owner_id: ownerId || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !objective) return { error: "목표 생성에 실패했습니다" };

  const krTitles = keyResults.map((k) => k.trim()).filter(Boolean);
  if (krTitles.length > 0) {
    await adminClient.from("okr_key_results").insert(
      krTitles.map((title, i) => ({
        objective_id: objective.id,
        title,
        progress: 0,
        sort_order: i,
      })),
    );
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function updateObjective(
  projectId: string,
  objectiveId: string,
  title: string,
  description: string,
  ownerId: string | null,
) {
  const auth = await authorize(projectId);
  if ("error" in auth) return auth;
  const { adminClient } = auth;

  if (!title.trim()) return { error: "목표를 입력해주세요" };

  const { error } = await adminClient
    .from("okr_objectives")
    .update({
      title: title.trim(),
      description: description.trim() || null,
      owner_id: ownerId || null,
    })
    .eq("id", objectiveId)
    .eq("project_id", projectId);
  if (error) return { error: "목표 수정에 실패했습니다" };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function deleteObjective(projectId: string, objectiveId: string) {
  const auth = await authorize(projectId);
  if ("error" in auth) return auth;
  const { adminClient } = auth;

  const { error } = await adminClient
    .from("okr_objectives")
    .delete()
    .eq("id", objectiveId)
    .eq("project_id", projectId);
  if (error) return { error: "목표 삭제에 실패했습니다" };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function createKeyResult(
  projectId: string,
  objectiveId: string,
  title: string,
) {
  const auth = await authorize(projectId);
  if ("error" in auth) return auth;
  const { adminClient } = auth;

  if (!title.trim()) return { error: "핵심결과를 입력해주세요" };

  // objective가 이 프로젝트 소속인지 확인
  const { data: obj } = await adminClient
    .from("okr_objectives")
    .select("id")
    .eq("id", objectiveId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!obj) return { error: "권한이 없습니다" };

  const { count } = await adminClient
    .from("okr_key_results")
    .select("id", { count: "exact", head: true })
    .eq("objective_id", objectiveId);

  const { error } = await adminClient.from("okr_key_results").insert({
    objective_id: objectiveId,
    title: title.trim(),
    progress: 0,
    sort_order: count || 0,
  });
  if (error) return { error: "핵심결과 생성에 실패했습니다" };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function updateKeyResultProgress(
  projectId: string,
  keyResultId: string,
  progress: number,
) {
  const auth = await authorize(projectId);
  if ("error" in auth) return auth;
  const { adminClient } = auth;

  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const { error } = await adminClient
    .from("okr_key_results")
    .update({ progress: clamped })
    .eq("id", keyResultId);
  if (error) return { error: "진행률 업데이트에 실패했습니다" };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function updateKeyResultTitle(
  projectId: string,
  keyResultId: string,
  title: string,
) {
  const auth = await authorize(projectId);
  if ("error" in auth) return auth;
  const { adminClient } = auth;

  if (!title.trim()) return { error: "핵심결과를 입력해주세요" };
  const { error } = await adminClient
    .from("okr_key_results")
    .update({ title: title.trim() })
    .eq("id", keyResultId);
  if (error) return { error: "수정에 실패했습니다" };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function deleteKeyResult(projectId: string, keyResultId: string) {
  const auth = await authorize(projectId);
  if ("error" in auth) return auth;
  const { adminClient } = auth;

  const { error } = await adminClient
    .from("okr_key_results")
    .delete()
    .eq("id", keyResultId);
  if (error) return { error: "핵심결과 삭제에 실패했습니다" };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
