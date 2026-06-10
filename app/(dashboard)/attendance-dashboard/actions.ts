"use server";

import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { kstStartOfToday, kstAddDays, kstStartOfMonth, toKstParts } from "@/lib/date";
import { isLateClockIn } from "@/lib/attendance";

export async function getAttendanceDashboardData() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (
    !profile?.company_id ||
    (profile.role !== "admin")
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

  // 오늘(한국 날짜) 출퇴근 기록. 전날 퇴근 누락 기록은 오늘 범위 밖이라 제외된다.
  const today = kstStartOfToday();
  const tomorrow = kstAddDays(new Date(), 1);

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

  // 이번 주 출근율 (월~금) — 한국 요일 기준
  const now = new Date();
  const dayOfWeek = toKstParts(now).getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = kstAddDays(now, mondayOffset);

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
    const d = toKstParts(new Date(r.clock_in)).getUTCDay();
    if (d >= 1 && d <= 5) {
      weekdayAttendance[d - 1]++;
    }
  });

  // 이번 달 통계 — 한국 날짜 기준
  const monthStart = kstStartOfMonth(now);
  const { data: monthRecords } = await adminClient
    .from("attendances")
    .select("employee_id, clock_in, clock_out")
    .eq("company_id", companyId)
    .gte("clock_in", monthStart.toISOString())
    .lt("clock_in", tomorrow.toISOString());

  // 근무시간 설정
  const { data: workSettings } = await adminClient
    .from("company_work_settings")
    .select("required_hours, work_type, fixed_start, flexible_end, core_time_enabled, core_time_start")
    .eq("company_id", companyId)
    .single();

  const requiredHours = Number(workSettings?.required_hours ?? 8);

  // 지각자 (근무유형별 출근 마감 기준, KST)
  let lateCount = 0;
  todayRecords?.forEach((r) => {
    if (isLateClockIn(r.clock_in, workSettings)) lateCount++;
  });

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
      isLate: (() => {
        const ci = todayRecords?.find((r) => r.employee_id === m.id)?.clock_in;
        return ci ? isLateClockIn(ci, workSettings) : false;
      })(),
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
