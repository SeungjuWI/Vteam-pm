import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
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
      .select("id, title, description, status, priority, due_date, created_at")
      .eq("project_id", id)
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

  const tasks = (tasksRes.data || []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status as "todo" | "in_progress" | "done",
    priority: t.priority as "low" | "medium" | "high",
    assignees: taskAssigneesMap[t.id] || [],
    dueDate: t.due_date,
  }));

  const isMember = memberIds.includes(user.id);
  const isManager = profile.role === "manager" || profile.role === "admin";

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
      tasks={tasks}
      isManager={isManager}
      isMember={isMember}
      currentUserId={user.id}
    />
  );
}
