"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getAttendanceDashboardData() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (
    !profile?.company_id ||
    (profile.role !== "manager" && profile.role !== "admin")
  ) {
    return null;
  }

  const companyId = profile.company_id;

  // 활성 멤버 목록
  const { data: members } = await adminClient
    .from("profiles")
    .select("id, name, position, avatar_url, role")
    .eq("company_id", companyId)
    .eq("status", "active")
    .neq("is_bot", true)
    .order("name");

  const totalMembers = members?.length ?? 0;

  // 오늘 출퇴근 기록
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: todayRecords } = await adminClient
    .from("attendances")
    .select("id, employee_id, clock_in, clock_out")
    .eq("company_id", companyId)
    .gte("clock_in", today.toISOString())
    .lt("clock_in", tomorrow.toISOString());

  const clockedInIds = new Set(
    todayRecords?.map((r) => r.employee_id) ?? [],
  );
  const clockedOutIds = new Set(
    todayRecords
      ?.filter((r) => r.clock_out)
      .map((r) => r.employee_id) ?? [],
  );
  const workingIds = new Set(
    todayRecords
      ?.filter((r) => !r.clock_out)
      .map((r) => r.employee_id) ?? [],
  );

  // 이번 주 출근율 (월~금)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const { data: weekRecords } = await adminClient
    .from("attendances")
    .select("employee_id, clock_in, clock_out")
    .eq("company_id", companyId)
    .gte("clock_in", monday.toISOString())
    .lt("clock_in", tomorrow.toISOString());

  // 요일별 출근 인원 수
  const weekdayAttendance: number[] = [0, 0, 0, 0, 0];
  const passedWorkdays = Math.min(
    dayOfWeek === 0 ? 5 : dayOfWeek,
    5,
  );

  weekRecords?.forEach((r) => {
    const d = new Date(r.clock_in).getDay();
    if (d >= 1 && d <= 5) {
      weekdayAttendance[d - 1]++;
    }
  });

  // 이번 달 통계
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const { data: monthRecords } = await adminClient
    .from("attendances")
    .select("employee_id, clock_in, clock_out")
    .eq("company_id", companyId)
    .gte("clock_in", monthStart.toISOString())
    .lt("clock_in", tomorrow.toISOString());

  // 근무시간 설정
  const { data: workSettings } = await adminClient
    .from("company_work_settings")
    .select("required_hours, fixed_start")
    .eq("company_id", companyId)
    .single();

  const requiredHours = Number(workSettings?.required_hours ?? 8);

  // 지각자 (고정 출근시간 기준)
  let lateCount = 0;
  if (workSettings?.fixed_start) {
    const [h, m] = (workSettings.fixed_start as string).split(":").map(Number);
    todayRecords?.forEach((r) => {
      const clockIn = new Date(r.clock_in);
      if (clockIn.getHours() > h || (clockIn.getHours() === h && clockIn.getMinutes() > m)) {
        lateCount++;
      }
    });
  }

  // 평균 근무시간 (이번 달)
  let totalWorkHours = 0;
  let completedRecords = 0;
  monthRecords?.forEach((r) => {
    if (r.clock_out) {
      const diff =
        new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime();
      totalWorkHours += diff / (1000 * 60 * 60);
      completedRecords++;
    }
  });
  const avgWorkHours =
    completedRecords > 0
      ? Math.round((totalWorkHours / completedRecords) * 10) / 10
      : 0;

  // 멤버별 오늘 상태
  const memberStatus =
    members?.map((m) => ({
      id: m.id as string,
      name: m.name as string,
      position: (m.position as string) ?? "",
      avatarUrl: (m.avatar_url as string) ?? "",
      role: m.role as string,
      status: workingIds.has(m.id as string)
        ? ("working" as const)
        : clockedOutIds.has(m.id as string)
          ? ("done" as const)
          : ("absent" as const),
      clockIn:
        todayRecords?.find((r) => r.employee_id === m.id)?.clock_in ?? null,
      clockOut:
        todayRecords?.find((r) => r.employee_id === m.id)?.clock_out ?? null,
    })) ?? [];

  return {
    totalMembers,
    todayClockedIn: clockedInIds.size,
    todayWorking: workingIds.size,
    todayDone: clockedOutIds.size,
    todayAbsent: totalMembers - clockedInIds.size,
    lateCount,
    avgWorkHours,
    requiredHours,
    weekdayAttendance,
    passedWorkdays,
    memberStatus,
  };
}
