import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import { getT } from "@/lib/i18n/server";
import MyTasksView from "./my-tasks-view";

export default async function MyTasksPage() {
  const t = await getT();
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  const adminClient = createAdminClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = todayStart.toISOString().split("T")[0];

  const [{ data: activeTasksRaw }, { data: doneTasksRaw }] = await Promise.all([
    adminClient
      .from("task_assignees")
      .select("tasks!inner(id, title, status, priority, due_date, projects!inner(id, name, company_id))")
      .eq("member_id", user.id)
      .neq("tasks.status", "done"),
    adminClient
      .from("task_assignees")
      .select("tasks!inner(id, title, status, priority, due_date, projects!inner(id, name, company_id))")
      .eq("member_id", user.id)
      .eq("tasks.status", "done"),
  ]);

  type TaskRow = {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    projects: { id: string; name: string; company_id: string };
  };

  const filterCompanyTasks = (raw: typeof activeTasksRaw) =>
    (raw || [])
      .map((r) => (r as unknown as { tasks: TaskRow }).tasks)
      .filter((tk): tk is TaskRow => tk !== null && tk.projects?.company_id === profile.company_id);

  const activeTasks = filterCompanyTasks(activeTasksRaw);
  const doneTasks = filterCompanyTasks(doneTasksRaw);

  const allTasks = [...activeTasks, ...doneTasks];

  const projects = Array.from(
    new Map(allTasks.map((t) => [t.projects.id, t.projects.name])).entries()
  ).map(([id, name]) => ({ id, name }));

  const stats = {
    total: allTasks.length,
    dueToday: activeTasks.filter((t) => t.due_date === today).length,
    overdue: activeTasks.filter((t) => t.due_date && t.due_date < today).length,
    done: doneTasks.length,
  };

  return (
    <MyTasksView
      activeTasks={activeTasks}
      doneTasks={doneTasks}
      projects={projects}
      stats={stats}
      today={today}
    />
  );
}
