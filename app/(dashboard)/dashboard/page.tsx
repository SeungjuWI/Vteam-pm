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
          <p className="mt-1 text-2xl font-semibold text-gray-900">0개</p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">오늘 마감 태스크</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">0개</p>
        </div>
      </div>

      <TeamTimeline records={timelineRecords} />

      <div className="flex h-64 items-center justify-center rounded-xl bg-white">
        <p className="text-sm text-gray-400">최근 태스크가 여기에 표시됩니다</p>
      </div>
    </div>
  );
}
