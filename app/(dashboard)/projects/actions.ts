"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";

// ── 회사 소유권 검증 (멀티테넌트 격리: 다른 회사 리소스 접근 차단) ──
type Admin = ReturnType<typeof createAdminClient>;
async function getCompanyId(adminClient: Admin, userId: string): Promise<string | null> {
  const { data } = await adminClient.from("profiles").select("company_id").eq("id", userId).single();
  return (data?.company_id as string) ?? null;
}
async function projectInCompany(adminClient: Admin, projectId: string, companyId: string): Promise<boolean> {
  const { data } = await adminClient.from("projects").select("company_id").eq("id", projectId).single();
  return !!data && data.company_id === companyId;
}
async function taskInCompany(adminClient: Admin, taskId: string, companyId: string): Promise<boolean> {
  const { data: task } = await adminClient.from("tasks").select("project_id").eq("id", taskId).single();
  if (!task) return false;
  return projectInCompany(adminClient, task.project_id as string, companyId);
}
async function milestoneInCompany(adminClient: Admin, milestoneId: string, companyId: string): Promise<boolean> {
  const { data: ms } = await adminClient.from("project_milestones").select("project_id").eq("id", milestoneId).single();
  if (!ms) return false;
  return projectInCompany(adminClient, ms.project_id as string, companyId);
}
const DENY = { error: "권한이 없습니다" };

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, name")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) {
    return { error: "권한이 없습니다" };
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "프로젝트 이름을 입력해주세요" };

  const description = (formData.get("description") as string)?.trim() || null;
  const memberIds = (formData.get("memberIds") as string)?.split(",").filter(Boolean) || [];

  // 이미지 업로드 처리
  let imageUrl: string | null = null;
  const imageFile = formData.get("image") as File | null;

  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > 2 * 1024 * 1024) {
      return { error: "이미지는 2MB 이하만 가능합니다" };
    }

    const ext = imageFile.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `${profile.company_id}/project_${Date.now()}.${ext}`;

    const { error: uploadError } = await adminClient.storage
      .from("project-images")
      .upload(filePath, imageFile, { upsert: true });

    if (uploadError) return { error: "이미지 업로드에 실패했습니다" };

    const { data: urlData } = adminClient.storage
      .from("project-images")
      .getPublicUrl(filePath);

    imageUrl = urlData.publicUrl;
  }

  // 프로젝트 생성
  const { data: project, error } = await adminClient
    .from("projects")
    .insert({
      company_id: profile.company_id,
      name,
      description,
      image_url: imageUrl,
    })
    .select("id")
    .single();

  if (error || !project) return { error: "프로젝트 생성에 실패했습니다" };

  // 멤버 추가 + 알림
  if (memberIds.length > 0) {
    await adminClient.from("project_members").insert(
      memberIds.map((mid) => ({ project_id: project.id, member_id: mid }))
    );

    await adminClient.from("notifications").insert(
      memberIds.map((mid) => ({
        user_id: mid,
        company_id: profile.company_id,
        type: "project_invite",
        title: "새 프로젝트에 배정되었습니다",
        message: `${profile.name}님이 "${name}" 프로젝트에 담당자로 배정했습니다.`,
        link: `/projects/${project.id}`,
      }))
    );
  }

  revalidatePath("/projects");
  return { success: true };
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) {
    return { error: "권한이 없습니다" };
  }

  // 프로젝트 삭제는 관리자(admin)만 — 회사 내 모든 프로젝트 삭제 가능
  if (profile.role !== "admin") {
    return { error: "프로젝트 삭제 권한이 없습니다 (관리자 전용)" };
  }

  const { data: project } = await adminClient
    .from("projects")
    .select("company_id")
    .eq("id", projectId)
    .single();

  if (!project || project.company_id !== profile.company_id) {
    return { error: "프로젝트를 찾을 수 없습니다" };
  }

  // 태스크 먼저 삭제 (project_members는 on delete cascade)
  await adminClient.from("tasks").delete().eq("project_id", projectId);
  await adminClient.from("projects").delete().eq("id", projectId);

  revalidatePath("/projects");
  return { success: true };
}

export async function updateProject(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) {
    return { error: "권한이 없습니다" };
  }

  const projectId = formData.get("projectId") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "프로젝트 이름을 입력해주세요" };

  const description = (formData.get("description") as string)?.trim() || null;

  // 이미지 업로드
  let imageUrl: string | undefined;
  const imageFile = formData.get("image") as File | null;
  const removeImage = formData.get("removeImage") === "true";

  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > 2 * 1024 * 1024) {
      return { error: "이미지는 2MB 이하만 가능합니다" };
    }
    const ext = imageFile.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `${profile.company_id}/project_${Date.now()}.${ext}`;

    const { error: uploadError } = await adminClient.storage
      .from("project-images")
      .upload(filePath, imageFile, { upsert: true });

    if (uploadError) return { error: "이미지 업로드에 실패했습니다" };

    const { data: urlData } = adminClient.storage
      .from("project-images")
      .getPublicUrl(filePath);

    imageUrl = urlData.publicUrl;
  } else if (removeImage) {
    imageUrl = "";
  }

  const payload: Record<string, unknown> = { name, description };
  if (imageUrl !== undefined) payload.image_url = imageUrl || null;

  const { error } = await adminClient
    .from("projects")
    .update(payload)
    .eq("id", projectId)
    .eq("company_id", profile.company_id);

  if (error) return { error: "수정에 실패했습니다" };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true };
}

export async function addProjectMember(projectId: string, memberId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, name")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) {
    return { error: "권한이 없습니다" };
  }

  const { data: project } = await adminClient
    .from("projects")
    .select("name, company_id")
    .eq("id", projectId)
    .single();

  if (!project || project.company_id !== profile.company_id) {
    return { error: "프로젝트를 찾을 수 없습니다" };
  }

  const { error } = await adminClient
    .from("project_members")
    .insert({ project_id: projectId, member_id: memberId });

  if (error) {
    if (error.code === "23505") return { error: "이미 참여 중인 멤버입니다" };
    return { error: "멤버 추가에 실패했습니다" };
  }

  // 알림 발송
  await adminClient.from("notifications").insert({
    user_id: memberId,
    company_id: profile.company_id,
    type: "project_invite",
    title: "프로젝트에 배정되었습니다",
    message: `${profile.name}님이 "${project.name}" 프로젝트에 담당자로 배정했습니다.`,
    link: `/projects/${projectId}`,
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function removeProjectMember(projectId: string, memberId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) {
    return { error: "권한이 없습니다" };
  }

  if (!(await projectInCompany(adminClient, projectId, profile.company_id))) return DENY;

  await adminClient
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("member_id", memberId);

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function createTask(
  projectId: string,
  title: string,
  description: string,
  priority: string,
  dueDate: string,
  assigneeIds: string[],
  status: string = "todo",
  parentTaskId: string | null = null,
) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, name")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return { error: "권한이 없습니다" };

  if (!title.trim()) return { error: "제목을 입력해주세요" };

  if (!(await projectInCompany(adminClient, projectId, profile.company_id))) return { error: "프로젝트를 찾을 수 없습니다" };
  if (parentTaskId && !(await taskInCompany(adminClient, parentTaskId, profile.company_id))) return { error: "부모 태스크를 찾을 수 없습니다" };

  const { data: authorProfile } = await adminClient
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .single();

  const { data: task, error } = await adminClient
    .from("tasks")
    .insert({
      project_id: projectId,
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      due_date: dueDate || null,
      parent_task_id: parentTaskId,
      source_language: authorProfile?.language || "ko",
    })
    .select("id")
    .single();

  if (error || !task) return { error: "태스크 생성에 실패했습니다" };

  if (assigneeIds.length > 0) {
    await adminClient.from("task_assignees").insert(
      assigneeIds.map((mid) => ({ task_id: task.id, member_id: mid }))
    );

    // 본인 제외 알림
    const others = assigneeIds.filter((id) => id !== user.id);
    if (others.length > 0) {
      await adminClient.from("notifications").insert(
        others.map((mid) => ({
          user_id: mid,
          company_id: profile.company_id,
          type: "task_assign",
          title: "새 태스크가 배정되었습니다",
          message: `${profile.name}님이 "${title.trim()}" 태스크를 배정했습니다.`,
          link: `/projects/${projectId}`,
        }))
      );
    }
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// 인라인 빠른 추가 (제목만) — 메인태스크는 parentTaskId=null, 서브태스크는 부모 id
export async function quickAddTask(
  projectId: string,
  title: string,
  parentTaskId: string | null,
  dueDate: string | null,
) {
  return createTask(projectId, title, "", "medium", dueDate || "", [], "todo", parentTaskId);
}

export async function updateTaskStatus(taskId: string, status: string, projectId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const companyId = await getCompanyId(adminClient, user.id);
  if (!companyId || !(await taskInCompany(adminClient, taskId, companyId))) return DENY;

  const { error } = await adminClient
    .from("tasks")
    .update({ status })
    .eq("id", taskId);

  if (error) return { error: "상태 변경에 실패했습니다" };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function updateTask(
  taskId: string,
  projectId: string,
  title: string,
  description: string,
  priority: string,
  dueDate: string,
  assigneeIds: string[],
  output: string = "",
  startDate: string | null = null,
  progress: number = 0,
) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  if (!title.trim()) return { error: "제목을 입력해주세요" };

  const companyId = await getCompanyId(adminClient, user.id);
  if (!companyId || !(await taskInCompany(adminClient, taskId, companyId))) return DENY;

  const { data: editorProfile } = await adminClient
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .single();

  const { error } = await adminClient
    .from("tasks")
    .update({
      title: title.trim(),
      description: description.trim() || null,
      output: output.trim() || null,
      progress: Math.max(0, Math.min(100, Math.round(progress) || 0)),
      priority,
      due_date: dueDate || null,
      start_date: startDate || null,
      source_language: editorProfile?.language || "ko",
    })
    .eq("id", taskId);

  if (error) return { error: "수정에 실패했습니다" };

  // 내용 변경 → 기존 번역 캐시 무효화(다음 조회 시 재번역)
  await adminClient.from("task_translations").delete().eq("task_id", taskId);

  // 담당자 교체: 기존 삭제 → 새로 추가
  await adminClient.from("task_assignees").delete().eq("task_id", taskId);
  if (assigneeIds.length > 0) {
    await adminClient.from("task_assignees").insert(
      assigneeIds.map((mid) => ({ task_id: taskId, member_id: mid }))
    );
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function updateTaskChecklist(
  taskId: string,
  projectId: string,
  items: { id: string; text: string; done: boolean }[],
) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const companyId = await getCompanyId(adminClient, user.id);
  if (!companyId || !(await taskInCompany(adminClient, taskId, companyId))) return DENY;

  // 입력 정제: 빈 항목 제거, 필드만 추림
  const clean = (Array.isArray(items) ? items : [])
    .map((it) => ({ id: String(it.id || ""), text: String(it.text || "").slice(0, 500), done: !!it.done }))
    .filter((it) => it.id && it.text.trim());

  const { error } = await adminClient.from("tasks").update({ checklist: clean }).eq("id", taskId);
  if (error) return { error: "저장에 실패했습니다" };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function deleteTask(taskId: string, projectId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const companyId = await getCompanyId(adminClient, user.id);
  if (!companyId || !(await taskInCompany(adminClient, taskId, companyId))) return DENY;

  // task_assignees는 on delete cascade
  await adminClient.from("tasks").delete().eq("id", taskId);

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function getTaskComments(taskId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const user = await getClaimsUser(supabase);
  if (!user) return [];
  const companyId = await getCompanyId(adminClient, user.id);
  if (!companyId || !(await taskInCompany(adminClient, taskId, companyId))) return [];

  const { data } = await adminClient
    .from("task_comments")
    .select("id, content, created_at, author_id")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (!data) return [];

  const authorIds = [...new Set(data.map((c) => c.author_id))];
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", authorIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  return data.map((c) => {
    const author = profileMap.get(c.author_id);
    return {
      id: c.id,
      content: c.content,
      authorName: author?.name ?? "알 수 없음",
      authorAvatarUrl: author?.avatar_url ?? null,
      createdAt: c.created_at,
    };
  });
}

export async function createTaskComment(
  taskId: string,
  projectId: string,
  content: string,
  mentionedIds: string[],
  isAll: boolean,
) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  if (!content.trim()) return { error: "내용을 입력해주세요" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("name, company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return { error: "프로필을 찾을 수 없습니다" };

  const { data: tk } = await adminClient.from("tasks").select("project_id").eq("id", taskId).single();
  if (!tk || tk.project_id !== projectId || !(await projectInCompany(adminClient, projectId, profile.company_id))) return DENY;

  const { error } = await adminClient.from("task_comments").insert({
    task_id: taskId,
    author_id: user.id,
    content: content.trim(),
  });

  if (error) return { error: "댓글 작성에 실패했습니다" };

  // 태스크 제목 조회
  const { data: task } = await adminClient
    .from("tasks")
    .select("title")
    .eq("id", taskId)
    .single();

  const taskTitle = task?.title ?? "태스크";

  // @all이면 프로젝트 멤버 전원
  let notifyIds = mentionedIds.filter((id) => id !== user.id);

  if (isAll) {
    const { data: pm } = await adminClient
      .from("project_members")
      .select("member_id")
      .eq("project_id", projectId);

    if (pm) {
      notifyIds = [...new Set([...notifyIds, ...pm.map((p) => p.member_id)])].filter((id) => id !== user.id);
    }
  }

  if (notifyIds.length > 0) {
    await adminClient.from("notifications").insert(
      notifyIds.map((mid) => ({
        user_id: mid,
        company_id: profile.company_id,
        type: "general" as const,
        title: `"${taskTitle}"에 새 댓글`,
        message: `${profile.name}: ${content.trim().slice(0, 80)}`,
        link: `/projects/${projectId}`,
      }))
    );
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function deleteTaskComment(commentId: string, projectId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const companyId = await getCompanyId(adminClient, user.id);
  const { data: c } = await adminClient.from("task_comments").select("task_id").eq("id", commentId).single();
  if (!companyId || !c || !(await taskInCompany(adminClient, c.task_id as string, companyId))) return DENY;

  // 본인 댓글만 삭제
  await adminClient
    .from("task_comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", user.id);

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// 드래그로 태스크 기간 변경
export async function updateTaskDates(taskId: string, projectId: string, startDate: string | null, dueDate: string | null) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const companyId = await getCompanyId(adminClient, user.id);
  if (!companyId || !(await taskInCompany(adminClient, taskId, companyId))) return DENY;

  const { error } = await adminClient
    .from("tasks")
    .update({ start_date: startDate, due_date: dueDate })
    .eq("id", taskId);

  if (error) return { error: "기간 변경에 실패했습니다" };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// 드래그로 마일스톤 날짜 변경
export async function updateMilestoneDate(milestoneId: string, projectId: string, date: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const companyId = await getCompanyId(adminClient, user.id);
  if (!companyId || !(await milestoneInCompany(adminClient, milestoneId, companyId))) return DENY;

  const { error } = await adminClient
    .from("project_milestones")
    .update({ date })
    .eq("id", milestoneId);

  if (error) return { error: "마일스톤 변경에 실패했습니다" };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function addMilestone(projectId: string, title: string, date: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };
  if (!title.trim() || !date) return { error: "제목과 날짜를 입력해주세요" };

  const companyId = await getCompanyId(adminClient, user.id);
  if (!companyId || !(await projectInCompany(adminClient, projectId, companyId))) return DENY;

  const { error } = await adminClient
    .from("project_milestones")
    .insert({ project_id: projectId, title: title.trim(), date });

  if (error) return { error: "마일스톤 추가에 실패했습니다" };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function deleteMilestone(milestoneId: string, projectId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const companyId = await getCompanyId(adminClient, user.id);
  if (!companyId || !(await milestoneInCompany(adminClient, milestoneId, companyId))) return DENY;

  await adminClient.from("project_milestones").delete().eq("id", milestoneId);

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// 메인태스크 순서 변경 (드래그 정렬)
export async function reorderTasks(projectId: string, orderedIds: string[]) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const companyId = await getCompanyId(adminClient, user.id);
  if (!companyId || !(await projectInCompany(adminClient, projectId, companyId))) return DENY;

  for (let i = 0; i < orderedIds.length; i++) {
    await adminClient
      .from("tasks")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("project_id", projectId);
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// 서브태스크 순서 변경 (드래그 정렬) — 같은 부모 안에서만 정렬
export async function reorderSubtasks(projectId: string, parentTaskId: string, orderedIds: string[]) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const companyId = await getCompanyId(adminClient, user.id);
  if (!companyId || !(await projectInCompany(adminClient, projectId, companyId))) return DENY;

  for (let i = 0; i < orderedIds.length; i++) {
    await adminClient
      .from("tasks")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("project_id", projectId)
      .eq("parent_task_id", parentTaskId);
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// 프로젝트 순서 변경 (드래그 정렬)
export async function reorderProjects(orderedIds: string[]) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!profile?.company_id) return { error: "권한이 없습니다" };

  for (let i = 0; i < orderedIds.length; i++) {
    await adminClient
      .from("projects")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("company_id", profile.company_id);
  }

  revalidatePath("/projects");
  return { success: true };
}

export async function updateProjectStatus(projectId: string, status: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) {
    return { error: "권한이 없습니다" };
  }

  const { error } = await adminClient
    .from("projects")
    .update({ status })
    .eq("id", projectId)
    .eq("company_id", profile.company_id);

  if (error) return { error: "상태 변경에 실패했습니다" };

  revalidatePath("/projects");
  return { success: true };
}
