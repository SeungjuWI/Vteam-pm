import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ProjectList from "./project-list";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;

  const isManager = profile.role === "manager" || profile.role === "admin";

  const [projectsRes, membersRes] = await Promise.all([
    adminClient
      .from("projects")
      .select("id, name, description, image_url, status, created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false }),
    adminClient
      .from("profiles")
      .select("id, name, email, avatar_url")
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .neq("is_bot", true)
      .order("name", { ascending: true }),
  ]);

  const rawProjects = projectsRes.data || [];
  const members = (membersRes.data || []).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    avatarUrl: m.avatar_url,
  }));

  // 프로젝트 멤버 + 태스크 수 집계
  const projectIds = rawProjects.map((p) => p.id);
  let projectMembersMap: Record<string, { name: string; avatarUrl: string | null }[]> = {};
  let taskCounts: Record<string, number> = {};

  if (projectIds.length > 0) {
    const [pmRes, taskRes] = await Promise.all([
      adminClient
        .from("project_members")
        .select("project_id, member_id")
        .in("project_id", projectIds),
      adminClient
        .from("tasks")
        .select("project_id")
        .in("project_id", projectIds),
    ]);

    if (pmRes.data) {
      for (const pm of pmRes.data) {
        const member = members.find((m) => m.id === pm.member_id);
        if (member) {
          if (!projectMembersMap[pm.project_id]) projectMembersMap[pm.project_id] = [];
          projectMembersMap[pm.project_id].push({ name: member.name, avatarUrl: member.avatarUrl });
        }
      }
    }

    if (taskRes.data) {
      for (const t of taskRes.data) {
        taskCounts[t.project_id] = (taskCounts[t.project_id] || 0) + 1;
      }
    }
  }

  const projects = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.image_url,
    status: p.status,
    members: projectMembersMap[p.id] || [],
    taskCount: taskCounts[p.id] || 0,
    createdAt: p.created_at,
  }));

  return (
    <div className="flex flex-col gap-6">
      <ProjectList projects={projects} members={members} isManager={isManager} />
    </div>
  );
}
