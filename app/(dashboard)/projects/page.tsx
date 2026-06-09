import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import ProjectPillars from "./project-pillars";

export default async function ProjectsPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  const adminClient = createAdminClient();

  const [projectsRes, membersRes] = await Promise.all([
    adminClient
      .from("projects")
      .select("id, name, status, image_url, sort_order, created_at")
      .eq("company_id", profile.company_id)
      .order("sort_order", { ascending: true, nullsFirst: false })
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
    id: m.id, name: m.name, email: m.email, avatarUrl: m.avatar_url,
  }));

  const projectIds = rawProjects.map((p) => p.id);
  let pmMap: Record<string, { name: string; avatarUrl: string | null }[]> = {};
  let nextMsMap: Record<string, { title: string; date: string }> = {};

  if (projectIds.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const [pmRes, msRes] = await Promise.all([
      adminClient.from("project_members").select("project_id, member_id").in("project_id", projectIds),
      adminClient.from("project_milestones").select("project_id, title, date").in("project_id", projectIds).gte("date", today).order("date", { ascending: true }),
    ]);
    for (const pm of pmRes.data || []) {
      const m = members.find((x) => x.id === pm.member_id);
      if (m) (pmMap[pm.project_id] ||= []).push({ name: m.name, avatarUrl: m.avatarUrl });
    }
    for (const ms of msRes.data || []) {
      if (!nextMsMap[ms.project_id]) nextMsMap[ms.project_id] = { title: ms.title, date: ms.date };
    }
  }

  const projects = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    imageUrl: p.image_url,
    members: pmMap[p.id] || [],
    nextMilestone: nextMsMap[p.id] || null,
  }));

  return <ProjectPillars projects={projects} members={members} isAdmin={profile.role === "admin"} />;
}
