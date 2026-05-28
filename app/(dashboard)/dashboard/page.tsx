import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import TeamTimeline from "../attendance/team-timeline";

export default async function DashboardPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: teamTodayRaw, error: teamError } = await adminClient
    .from("attendances")
    .select("id, clock_in, clock_out, profiles!attendances_employee_id_fkey(name, email, avatar_url, position)")
    .eq("company_id", profile.company_id)
    .gte("clock_in", todayStart.toISOString())
    .lte("clock_in", todayEnd.toISOString())
    .order("clock_in", { ascending: true });

  if (teamError) console.error("team query error:", teamError);

  type TeamRecord = { id: string; clock_in: string; clock_out: string | null; profiles: { name: string; email: string; avatar_url: string | null; position: string | null } };
  const teamToday = ((teamTodayRaw || []) as unknown as TeamRecord[]);

  const timelineRecords = teamToday.map((r) => ({
    name: r.profiles.name,
    email: r.profiles.email,
    avatarUrl: r.profiles.avatar_url,
    position: r.profiles.position,
    clockIn: r.clock_in,
    clockOut: r.clock_out,
  }));

  const { count } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id)
    .eq("status", "active");
  const totalMembers = count || 0;

  // 진행 중 프로젝트 수
  const { count: activeProjectCount } = await adminClient
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id)
    .eq("status", "active");

  // 오늘 마감 태스크 수
  const today = todayStart.toISOString().split("T")[0];
  const { count: todayTaskCount } = await adminClient
    .from("tasks")
    .select("id, projects!inner(company_id)", { count: "exact", head: true })
    .eq("projects.company_id", profile.company_id)
    .eq("due_date", today)
    .neq("status", "done");

  // 내 태스크 (할당된 것 중 미완료)
  const { data: myTasksRaw } = await adminClient
    .from("task_assignees")
    .select("tasks(id, title, status, priority, due_date, projects!inner(id, name, company_id))")
    .eq("member_id", user.id)
    .neq("tasks.status", "done");

  type TaskRow = { id: string; title: string; status: string; priority: string; due_date: string | null; projects: { id: string; name: string; company_id: string } };
  const myTasks = (myTasksRaw || [])
    .map((r) => (r as unknown as { tasks: TaskRow }).tasks)
    .filter((t): t is TaskRow => t !== null && t.projects?.company_id === profile.company_id);

  // 마감 임박 태스크 (오늘~7일 이내, 회사 전체)
  const weekLater = new Date(todayStart);
  weekLater.setDate(weekLater.getDate() + 7);
  const weekLaterStr = weekLater.toISOString().split("T")[0];

  const { data: upcomingTasksRaw } = await adminClient
    .from("tasks")
    .select("id, title, status, priority, due_date, projects!inner(id, name, company_id)")
    .eq("projects.company_id", profile.company_id)
    .neq("status", "done")
    .gte("due_date", today)
    .lte("due_date", weekLaterStr)
    .order("due_date", { ascending: true })
    .limit(10);

  const upcomingTasks = (upcomingTasksRaw || []) as unknown as TaskRow[];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-gray-900">대시보드</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">오늘 출근</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {teamToday.length}<span className="text-sm font-normal text-gray-400">/{totalMembers}명</span>
          </p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">미출근</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {totalMembers - teamToday.length}<span className="text-sm font-normal text-gray-400">명</span>
          </p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">진행 중 프로젝트</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{activeProjectCount || 0}개</p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">오늘 마감 태스크</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{todayTaskCount || 0}개</p>
        </div>
      </div>

      <TeamTimeline records={timelineRecords} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 내 태스크 */}
        <div className="rounded-xl bg-white p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-4">내 태스크</h2>
          {myTasks.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-gray-400">할당된 태스크가 없습니다</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {myTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                      task.status === "in_progress" ? "bg-blue-500" : "bg-gray-300"
                    }`} />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{task.title}</p>
                      <p className="text-xs text-gray-400">{task.projects.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      task.priority === "high" ? "bg-red-50 text-red-600" : task.priority === "medium" ? "bg-yellow-50 text-yellow-600" : "bg-gray-50 text-gray-500"
                    }`}>
                      {task.priority === "high" ? "높음" : task.priority === "medium" ? "보통" : "낮음"}
                    </span>
                    {task.due_date && (
                      <span className="text-xs text-gray-400">{task.due_date}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 마감 임박 태스크 */}
        <div className="rounded-xl bg-white p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-4">마감 임박</h2>
          {upcomingTasks.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-gray-400">이번 주 마감 태스크가 없습니다</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {upcomingTasks.map((task) => {
                const dDay = Math.ceil((new Date(task.due_date!).getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={task.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                        dDay === 0 ? "bg-red-500" : dDay <= 2 ? "bg-yellow-500" : "bg-gray-300"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{task.title}</p>
                        <p className="text-xs text-gray-400">{task.projects.name}</p>
                      </div>
                    </div>
                    <span className={`text-xs shrink-0 ml-4 ${
                      dDay === 0 ? "text-red-500 font-medium" : "text-gray-400"
                    }`}>
                      {dDay === 0 ? "오늘 마감" : `D-${dDay}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
