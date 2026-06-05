import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import { kstStartOfToday, kstAddDays } from "@/lib/date";
import TeamTimeline from "../attendance/team-timeline";
import Board from "./board";
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
    { count: activeProjectCount },
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
      .select("id", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "active"),
  ]);

  if (teamError) console.error("team query error:", teamError);

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

      <TeamTimeline records={timelineRecords} />

      <Board currentUserId={user.id} companyId={profile.company_id} />
    </div>
  );
}
