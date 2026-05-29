import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import ClockButton from "./clock-button";
import AttendanceCalendar from "./attendance-calendar";
import { getT } from "@/lib/i18n/server";

export default async function AttendancePage() {
  const t = await getT();
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  const adminClient = createAdminClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const [
    { data: todayRecord },
    { data: calendarRecords },
    { data: leaveRecords },
    { data: workSettings },
  ] = await Promise.all([
    adminClient
      .from("attendances")
      .select("id, clock_in, clock_out")
      .eq("employee_id", user.id)
      .gte("clock_in", todayStart.toISOString())
      .lte("clock_in", todayEnd.toISOString())
      .order("clock_in", { ascending: false })
      .limit(1)
      .single(),
    adminClient
      .from("attendances")
      .select("clock_in, clock_out")
      .eq("employee_id", user.id)
      .gte("clock_in", rangeStart.toISOString())
      .lte("clock_in", rangeEnd.toISOString())
      .order("clock_in", { ascending: false }),
    adminClient
      .from("leaves")
      .select("start_date, end_date, type, status, duration_hours")
      .eq("employee_id", user.id)
      .eq("status", "approved")
      .gte("end_date", rangeStart.toISOString().split("T")[0])
      .lte("start_date", rangeEnd.toISOString().split("T")[0]),
    adminClient
      .from("company_work_settings")
      .select("required_hours")
      .eq("company_id", profile.company_id)
      .single(),
  ]);

  const isClockedIn = todayRecord ? !todayRecord.clock_out : false;
  const requiredHours = workSettings?.required_hours ? Number(workSettings.required_hours) : 8;

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
