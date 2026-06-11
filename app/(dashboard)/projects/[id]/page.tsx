import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import { translateTasks } from "@/lib/translate-tasks";
import { notFound } from "next/navigation";
import ProjectDetail from "./project-detail";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  const adminClient = createAdminClient();

  const { data: project } = await adminClient
    .from("projects")
    .select("id, name, description, image_url, status, created_at")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .single();

  if (!project) notFound();

  // 멤버, 태스크 병렬 조회
  const [pmRes, tasksRes, membersRes] = await Promise.all([
    adminClient
      .from("project_members")
      .select("member_id")
      .eq("project_id", id),
    adminClient
      .from("tasks")
      .select("id, title, description, output, status, priority, due_date, start_date, created_at, parent_task_id, source_language")
      .eq("project_id", id)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    adminClient
      .from("profiles")
      .select("id, name, email, avatar_url, position")
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .neq("is_bot", true)
      .order("name", { ascending: true }),
  ]);

  const allMembers = (membersRes.data || []).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    avatarUrl: m.avatar_url,
    position: m.position,
  }));

  const memberIds = (pmRes.data || []).map((pm) => pm.member_id);
  const projectMembers = allMembers.filter((m) => memberIds.includes(m.id));

  // 태스크 담당자 조회
  const taskIds = (tasksRes.data || []).map((t) => t.id);
  let taskAssigneesMap: Record<string, { name: string; avatarUrl: string | null }[]> = {};

  if (taskIds.length > 0) {
    const { data: taData } = await adminClient
      .from("task_assignees")
      .select("task_id, member_id")
      .in("task_id", taskIds);

    if (taData) {
      for (const ta of taData) {
        const member = allMembers.find((m) => m.id === ta.member_id);
        if (member) {
          if (!taskAssigneesMap[ta.task_id]) taskAssigneesMap[ta.task_id] = [];
          taskAssigneesMap[ta.task_id].push({ name: member.name, avatarUrl: member.avatarUrl });
        }
      }
    }
  }

  const allTasks = (tasksRes.data || []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    output: t.output as string | null,
    status: t.status as "todo" | "in_progress" | "done",
    priority: t.priority as "low" | "medium" | "high",
    assignees: taskAssigneesMap[t.id] || [],
    dueDate: t.due_date,
    startDate: t.start_date as string | null,
    parentTaskId: t.parent_task_id as string | null,
    sourceLanguage: (t.source_language as string) || "ko",
  }));

  // 보는 사람 언어로 태스크 제목/설명/결과물 번역 (작성자 언어와 다를 때만, 캐시 재사용)
  const myLang = profile.language || "ko";
  if (allTasks.some((t) => t.sourceLanguage !== myLang)) {
    const trMap = await translateTasks(
      adminClient,
      allTasks.map((t) => ({ id: t.id, title: t.title, description: t.description, output: t.output, sourceLanguage: t.sourceLanguage })),
      myLang,
    );
    for (const t of allTasks) {
      const tr = trMap.get(t.id);
      if (tr) { t.title = tr.title; t.description = tr.description; t.output = tr.output; }
    }
  }

  // 메인(parent 없음) + 서브(parent 있음) 트리 구성
  const subsByParent: Record<string, typeof allTasks> = {};
  for (const t of allTasks) {
    if (t.parentTaskId) (subsByParent[t.parentTaskId] ||= []).push(t);
  }
  const mainTasks = allTasks
    .filter((t) => !t.parentTaskId)
    .map((t) => ({
      ...t,
      subtasks: (subsByParent[t.id] || []).slice().reverse(), // 조회는 desc → 서브는 생성 오름차순
    }));

  // OKR 조회 (목표 + 핵심결과)
  const { data: objectivesData } = await adminClient
    .from("okr_objectives")
    .select("id, period, title, description, owner_id, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const objectiveIds = (objectivesData || []).map((o) => o.id);
  let keyResultsMap: Record<string, { id: string; title: string; progress: number }[]> = {};

  if (objectiveIds.length > 0) {
    const { data: krData } = await adminClient
      .from("okr_key_results")
      .select("id, objective_id, title, progress, sort_order")
      .in("objective_id", objectiveIds)
      .order("sort_order", { ascending: true });

    if (krData) {
      for (const kr of krData) {
        if (!keyResultsMap[kr.objective_id]) keyResultsMap[kr.objective_id] = [];
        keyResultsMap[kr.objective_id].push({ id: kr.id, title: kr.title, progress: kr.progress });
      }
    }
  }

  const objectives = (objectivesData || []).map((o) => ({
    id: o.id,
    period: o.period,
    title: o.title,
    description: o.description,
    ownerId: o.owner_id,
    keyResults: keyResultsMap[o.id] || [],
  }));

  // 마일스톤 조회
  const { data: msData } = await adminClient
    .from("project_milestones")
    .select("id, title, date")
    .eq("project_id", id)
    .order("date", { ascending: true });

  const milestones = (msData || []).map((m) => ({ id: m.id, title: m.title, date: m.date }));

  return (
    <ProjectDetail
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        imageUrl: project.image_url,
        status: project.status,
        createdAt: project.created_at,
      }}
      members={projectMembers}
      allMembers={allMembers}
      mainTasks={mainTasks}
      objectives={objectives}
      milestones={milestones}
      currentUserId={user.id}
    />
  );
}
