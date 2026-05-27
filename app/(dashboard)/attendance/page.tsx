import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ClockButton from "./clock-button";
import TeamTimeline from "./team-timeline";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(clockIn: string, clockOut: string | null) {
  const end = clockOut ? new Date(clockOut).getTime() : Date.now();
  const diff = end - new Date(clockIn).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}시간 ${m}분`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

export default async function AttendancePage() {
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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  const { data: todayRecord } = await adminClient
    .from("attendances")
    .select("id, clock_in, clock_out")
    .eq("employee_id", user.id)
    .gte("clock_in", todayStart.toISOString())
    .lte("clock_in", todayEnd.toISOString())
    .order("clock_in", { ascending: false })
    .limit(1)
    .single();

  const isClockedIn = todayRecord ? !todayRecord.clock_out : false;

  const { data: myWeekRecords } = await adminClient
    .from("attendances")
    .select("clock_in, clock_out")
    .eq("employee_id", user.id)
    .gte("clock_in", weekStart.toISOString())
    .order("clock_in", { ascending: false });

  const weekTotalMs = (myWeekRecords || []).reduce((sum, r) => {
    const end = r.clock_out ? new Date(r.clock_out).getTime() : Date.now();
    return sum + (end - new Date(r.clock_in).getTime());
  }, 0);
  const weekHours = Math.floor(weekTotalMs / 3600000);
  const weekMinutes = Math.floor((weekTotalMs % 3600000) / 60000);

  const { data: teamTodayRaw } = await adminClient
    .from("attendances")
    .select("id, clock_in, clock_out, profiles(name, email)")
    .eq("company_id", profile.company_id)
    .gte("clock_in", todayStart.toISOString())
    .lte("clock_in", todayEnd.toISOString())
    .order("clock_in", { ascending: true });

  type TeamRecord = { id: string; clock_in: string; clock_out: string | null; profiles: { name: string; email: string } };
  const teamToday = ((teamTodayRaw || []) as unknown as TeamRecord[]);

  const timelineRecords = teamToday.map((r) => ({
    name: r.profiles.name,
    email: r.profiles.email,
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
      <h1 className="text-lg font-semibold text-gray-900">출퇴근</h1>

      <div className="rounded-xl bg-white p-6">
        <ClockButton isClockedIn={isClockedIn} clockInTime={todayRecord?.clock_in || null} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-5">
          <p className="text-xs text-gray-500">오늘 근무</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {todayRecord ? formatDuration(todayRecord.clock_in, todayRecord.clock_out) : "0시간 0분"}
          </p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-xs text-gray-500">이번 주 근무</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{weekHours}시간 {weekMinutes}분</p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-xs text-gray-500">오늘 출근</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {teamToday.length}<span className="text-sm font-normal text-gray-400">/{totalMembers}명</span>
          </p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-xs text-gray-500">미출근</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {totalMembers - teamToday.length}<span className="text-sm font-normal text-gray-400">명</span>
          </p>
        </div>
      </div>

      <TeamTimeline records={timelineRecords} />

      <div className="rounded-xl bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-medium text-gray-900">이번 주 기록</h2>
        </div>
        {(!myWeekRecords || myWeekRecords.length === 0) ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-gray-400">이번 주 기록이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {myWeekRecords.map((record, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-3.5">
                <p className="text-sm text-gray-700">{formatDate(record.clock_in)}</p>
                <div className="text-right">
                  <p className="text-sm text-gray-700">
                    {formatTime(record.clock_in)}
                    {record.clock_out ? ` - ${formatTime(record.clock_out)}` : " ~"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDuration(record.clock_in, record.clock_out)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
