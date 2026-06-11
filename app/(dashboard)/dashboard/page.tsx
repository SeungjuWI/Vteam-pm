import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import { kstStartOfToday, kstAddDays } from "@/lib/date";
import TeamTimeline from "../attendance/team-timeline";
import Board from "./board";
import TeamDeadlines, { type DeadlineGroup, type DeadlineTask } from "./team-deadlines";
import { translateTasks } from "@/lib/translate-tasks";
import { getT } from "@/lib/i18n/server";

export default async function DashboardPage() {
  const t = await getT();
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  const adminClient = createAdminClient();

  const todayStart = kstStartOfToday();
  const todayEnd = kstAddDays(new Date(), 1);
  const [
    { data: teamTodayRaw, error: teamError },
    { count },
    { data: projRows },
    { data: companyMembers },
  ] = await Promise.all([
    adminClient
      .from("attendances")
      .select("id, clock_in, clock_out, profiles!attendances_employee_id_fkey(name, email, avatar_url, position)")
      .eq("company_id", profile.company_id)
      .gte("clock_in", todayStart.toISOString())
      .lt("clock_in", todayEnd.toISOString())
      .order("clock_in", { ascending: true }),
    adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .neq("is_bot", true),
    adminClient
      .from("projects")
      .select("id, name")
      .eq("company_id", profile.company_id)
      .eq("status", "active"),
    adminClient
      .from("profiles")
      .select("id, name, avatar_url")
      .eq("company_id", profile.company_id),
  ]);

  if (teamError) console.error("team query error:", teamError);

  const activeProjectCount = projRows?.length || 0;

  // 팀 전체 마감 현황: 회사 내 미완료 + 마감일 있는 태스크를 프로젝트별로 묶고 지연/임박 표시
  const todayMid = kstStartOfToday().getTime();
  const dueInfo = (due: string): { days: number; bucket: DeadlineTask["bucket"] } => {
    const dueMid = new Date(due + "T00:00:00+09:00").getTime();
    const days = Math.round((dueMid - todayMid) / 86400000);
    return { days, bucket: days < 0 ? "overdue" : days <= 3 ? "soon" : "upcoming" };
  };

  let deadlineGroups: DeadlineGroup[] = [];
  const projIds = (projRows || []).map((p) => p.id);
  if (projIds.length > 0) {
    const { data: dueTasks } = await adminClient
      .from("tasks")
      .select("id, title, description, output, due_date, project_id, source_language")
      .in("project_id", projIds)
      .neq("status", "done")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true });

    const tasks = dueTasks || [];
    const taskIds = tasks.map((tk) => tk.id);

    // 담당자
    const assigneeMap: Record<string, { name: string; avatarUrl: string | null }[]> = {};
    if (taskIds.length > 0) {
      const { data: taData } = await adminClient
        .from("task_assignees")
        .select("task_id, member_id")
        .in("task_id", taskIds);
      const mById = new Map((companyMembers || []).map((m) => [m.id, m]));
      for (const ta of taData || []) {
        const m = mById.get(ta.member_id);
        if (m) (assigneeMap[ta.task_id] ||= []).push({ name: m.name, avatarUrl: m.avatar_url });
      }
    }

    // 보는 사람 언어로 제목 번역 (작성자 언어와 다를 때만, 캐시 재사용)
    const myLang = profile.language || "ko";
    const titleMap = new Map<string, string>();
    if (tasks.some((tk) => (tk.source_language || "ko") !== myLang)) {
      const tr = await translateTasks(
        adminClient,
        tasks.map((tk) => ({ id: tk.id, title: tk.title, description: tk.description, output: tk.output as string | null, sourceLanguage: (tk.source_language as string) || "ko" })),
        myLang,
      );
      for (const tk of tasks) { const x = tr.get(tk.id); if (x) titleMap.set(tk.id, x.title); }
    }

    const projName = new Map((projRows || []).map((p) => [p.id, p.name]));
    const byProj: Record<string, DeadlineTask[]> = {};
    for (const tk of tasks) {
      const { days, bucket } = dueInfo(tk.due_date as string);
      (byProj[tk.project_id] ||= []).push({
        id: tk.id,
        title: titleMap.get(tk.id) || tk.title,
        dueDate: tk.due_date as string,
        days,
        bucket,
        assignees: assigneeMap[tk.id] || [],
      });
    }
    deadlineGroups = Object.entries(byProj)
      .map(([pid, ts]) => ({ projectId: pid, projectName: projName.get(pid) || "", tasks: ts.sort((a, b) => a.days - b.days) }))
      .sort((a, b) => (a.tasks[0]?.days ?? 9999) - (b.tasks[0]?.days ?? 9999));
  }

  type TeamRecord = { id: string; clock_in: string; clock_out: string | null; profiles: { name: string; email: string; avatar_url: string | null; position: string | null } };
  const teamToday = ((teamTodayRaw || []) as unknown as TeamRecord[]);
  const totalMembers = count || 0;

  const timelineRecords = teamToday.map((r) => ({
    name: r.profiles.name,
    email: r.profiles.email,
    avatarUrl: r.profiles.avatar_url,
    position: r.profiles.position,
    clockIn: r.clock_in,
    clockOut: r.clock_out,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-gray-900">{t("dashboard.title")}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">{t("dashboard.todayAttendance")}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {teamToday.length}<span className="text-sm font-normal text-gray-400">/{totalMembers}{t("dashboard.persons")}</span>
          </p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">{t("dashboard.absent")}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {totalMembers - teamToday.length}<span className="text-sm font-normal text-gray-400">{t("dashboard.persons")}</span>
          </p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">{t("dashboard.activeProjects")}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{activeProjectCount || 0}{t("dashboard.items")}</p>
        </div>
      </div>

      <TeamDeadlines groups={deadlineGroups} />

      <TeamTimeline records={timelineRecords} />

      <Board currentUserId={user.id} companyId={profile.company_id} />
    </div>
  );
}
