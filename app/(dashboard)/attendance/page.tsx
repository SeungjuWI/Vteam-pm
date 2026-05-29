import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ClockButton from "./clock-button";
import AttendanceCalendar from "./attendance-calendar";
import { getT, getLocale } from "@/lib/i18n/server";

export default async function AttendancePage() {
  const t = await getT();
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // 현재 달 전체 + 전후 1주 여유분 fetching
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

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

  // 달력용 출퇴근 기록 (넉넉하게 3개월분)
  const { data: calendarRecords } = await adminClient
    .from("attendances")
    .select("clock_in, clock_out")
    .eq("employee_id", user.id)
    .gte("clock_in", rangeStart.toISOString())
    .lte("clock_in", rangeEnd.toISOString())
    .order("clock_in", { ascending: false });

  // 승인된 휴가 기록
  const { data: leaveRecords } = await adminClient
    .from("leaves")
    .select("start_date, end_date, type, status, duration_hours")
    .eq("employee_id", user.id)
    .eq("status", "approved")
    .gte("end_date", rangeStart.toISOString().split("T")[0])
    .lte("start_date", rangeEnd.toISOString().split("T")[0]);

  // 회사 근무 설정에서 required_hours 가져오기
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  let requiredHours = 8;
  if (profile?.company_id) {
    const { data: workSettings } = await adminClient
      .from("company_work_settings")
      .select("required_hours")
      .eq("company_id", profile.company_id)
      .single();
    if (workSettings?.required_hours) {
      requiredHours = Number(workSettings.required_hours);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-gray-900">{t("attendance.title")}</h1>

      <div className="rounded-xl bg-white p-6">
        <ClockButton isClockedIn={isClockedIn} clockInTime={todayRecord?.clock_in || null} />
      </div>

      <AttendanceCalendar
        records={calendarRecords || []}
        leaves={leaveRecords || []}
        requiredHours={requiredHours}
      />
    </div>
  );
}
