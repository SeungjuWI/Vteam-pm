import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import ProjectTimelineMatrix from "./project-timeline-matrix";

type TaskRow = {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  status: string;
  due_date: string | null;
  title: string;
};

function monthKey(due: string | null): string {
  if (!due) return "tbd";
  const d = new Date(due);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ProjectsPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  const adminClient = createAdminClient();

  const [projectsRes, membersRes] = await Promise.all([
    adminClient
      .from("projects")
      .select("id, name, status, created_at")
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

  const projectIds = rawProjects.map((p) => p.id);
  let tasksData: TaskRow[] = [];
  if (projectIds.length > 0) {
    const { data } = await adminClient
      .from("tasks")
      .select("id, project_id, parent_task_id, status, due_date, title")
      .in("project_id", projectIds);
    tasksData = (data as TaskRow[]) || [];
  }

  // 서브태스크를 부모별로 묶어 진행률 계산에 사용
  const subsByParent: Record<string, TaskRow[]> = {};
  for (const tk of tasksData) {
    if (tk.parent_task_id) (subsByParent[tk.parent_task_id] ||= []).push(tk);
  }
  const completion = (tk: TaskRow): number => {
    const subs = subsByParent[tk.id] || [];
    if (subs.length > 0) return subs.filter((s) => s.status === "done").length / subs.length;
    return tk.status === "done" ? 1 : tk.status === "in_progress" ? 0.5 : 0;
  };

  const mains = tasksData.filter((tk) => !tk.parent_task_id);

  // 타임라인 컬럼: 마감일이 있는 메인태스크들의 최소~최대 월을 연속으로 채움 + (미정 있으면 마지막)
  const monthSet = new Set<string>();
  let hasTbd = false;
  for (const m of mains) {
    const k = monthKey(m.due_date);
    if (k === "tbd") hasTbd = true;
    else monthSet.add(k);
  }
  const columns: string[] = [];
  if (monthSet.size > 0) {
    const sorted = [...monthSet].sort();
    const [minY, minM] = sorted[0].split("-").map(Number);
    const [maxY, maxM] = sorted[sorted.length - 1].split("-").map(Number);
    let y = minY, mo = minM;
    while (y < maxY || (y === maxY && mo <= maxM)) {
      columns.push(`${y}-${String(mo).padStart(2, "0")}`);
      mo++;
      if (mo > 12) { mo = 1; y++; }
    }
  } else {
    const now = new Date();
    columns.push(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  }
  if (hasTbd) columns.push("tbd");

  const buildCell = (list: TaskRow[]) => {
    const comps = list.map(completion);
    const progress = Math.round((comps.reduce((a, b) => a + b, 0) / comps.length) * 100);
    return {
      progress,
      done: comps.filter((c) => c === 1).length,
      total: list.length,
      tasks: list.map((m) => ({ id: m.id, title: m.title, completion: Math.round(completion(m) * 100) })),
    };
  };

  const projects = rawProjects.map((p) => {
    const pMains = mains.filter((m) => m.project_id === p.id);
    const cells: Record<string, ReturnType<typeof buildCell>> = {};
    for (const k of columns) {
      const list = pMains.filter((m) => monthKey(m.due_date) === k);
      if (list.length > 0) cells[k] = buildCell(list);
    }
    const overall = pMains.length > 0
      ? Math.round((pMains.map(completion).reduce((a, b) => a + b, 0) / pMains.length) * 100)
      : 0;
    return { id: p.id, name: p.name, status: p.status, overall, cells };
  });

  // 전체(하단) 행
  const totals: Record<string, { progress: number; done: number; total: number }> = {};
  for (const k of columns) {
    const list = mains.filter((m) => monthKey(m.due_date) === k);
    if (list.length > 0) {
      const { progress, done, total } = buildCell(list);
      totals[k] = { progress, done, total };
    }
  }

  return (
    <ProjectTimelineMatrix projects={projects} columns={columns} totals={totals} members={members} />
  );
}
