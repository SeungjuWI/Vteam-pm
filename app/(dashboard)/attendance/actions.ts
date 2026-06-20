"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { kstStartOfToday } from "@/lib/date";
import { getClockIpState } from "@/lib/attendance-ip";

export async function clockIn() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, company_id, ip_policy_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return { error: "회사 정보가 없습니다" };

  const { allowed, ip } = await getClockIpState(adminClient, profile.ip_policy_id);
  if (!allowed) {
    return { error: "허용된 네트워크에서만 출퇴근할 수 있습니다" };
  }

  // 오늘(한국 날짜) 이미 출근했는지 확인
  const today = kstStartOfToday();

  const { data: existing } = await adminClient
    .from("attendances")
    .select("id")
    .eq("employee_id", user.id)
    .gte("clock_in", today.toISOString())
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { error: "이미 출근 상태입니다" };

  const { error } = await adminClient
    .from("attendances")
    .insert({
      employee_id: user.id,
      company_id: profile.company_id,
      clock_in: new Date().toISOString(),
      ip_address: ip,
    });

  if (error) return { error: error.message };

  revalidatePath("/attendance");
}

export async function getAttendanceStatus() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return null;

  const today = kstStartOfToday();

  const { data: record } = await adminClient
    .from("attendances")
    .select("id, clock_in, clock_out")
    .eq("employee_id", user.id)
    .gte("clock_in", today.toISOString())
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) return { status: "idle" as const, clockIn: null, clockOut: null };

  if (record.clock_out) {
    return { status: "done" as const, clockIn: record.clock_in, clockOut: record.clock_out };
  }

  return { status: "working" as const, clockIn: record.clock_in, clockOut: null };
}

export async function clockOut() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("ip_policy_id")
    .eq("id", user.id)
    .single();

  const { allowed } = await getClockIpState(adminClient, profile?.ip_policy_id ?? null);
  if (!allowed) {
    return { error: "허용된 네트워크에서만 출퇴근할 수 있습니다" };
  }

  // 밤샘 근무는 지원하지 않으므로 오늘(한국 날짜) 출근 기록만 퇴근 대상으로 본다.
  // 전날 퇴근을 누락한 기록은 여기서 잡히지 않고 '퇴근 누락'으로 남아 관리자가 정산한다.
  const today = kstStartOfToday();

  const { data: record } = await adminClient
    .from("attendances")
    .select("id")
    .eq("employee_id", user.id)
    .gte("clock_in", today.toISOString())
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) return { error: "출근 기록이 없습니다" };

  const { error } = await adminClient
    .from("attendances")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", record.id);

  if (error) return { error: error.message };

  revalidatePath("/attendance");
}

// 본인이 실수로 누른 퇴근을 취소 → 다시 근무중 상태로 (clock_out 비움).
// 오늘(한국 날짜) 퇴근까지 찍은 가장 최근 기록만 대상. 관리자 도움 없이 셀프 정정용.
export async function cancelClockOut() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const today = kstStartOfToday();

  const { data: record } = await adminClient
    .from("attendances")
    .select("id")
    .eq("employee_id", user.id)
    .gte("clock_in", today.toISOString())
    .not("clock_out", "is", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) return { error: "취소할 퇴근 기록이 없습니다" };

  const { error } = await adminClient
    .from("attendances")
    .update({ clock_out: null })
    .eq("id", record.id);

  if (error) return { error: error.message };

  revalidatePath("/attendance");
}

// ── 관리자용 출퇴근 관리 ──

export async function getEmployeeAttendances(employeeId: string, year: number, month: number) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id || profile.role !== "admin") return null;

  const { data: target } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", employeeId)
    .single();

  if (!target || target.company_id !== profile.company_id) return null;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const { data } = await adminClient
    .from("attendances")
    .select("id, clock_in, clock_out, memo")
    .eq("employee_id", employeeId)
    .gte("clock_in", start.toISOString())
    .lte("clock_in", end.toISOString())
    .order("clock_in", { ascending: false });

  return data ?? [];
}

export async function updateAttendance(
  attendanceId: string,
  clockIn: string,
  clockOut: string | null,
  memo?: string,
) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id || profile.role !== "admin") {
    return { error: "권한이 없습니다" };
  }

  const { data: attendance } = await adminClient
    .from("attendances")
    .select("company_id")
    .eq("id", attendanceId)
    .single();

  if (!attendance || attendance.company_id !== profile.company_id) {
    return { error: "수정 권한이 없습니다" };
  }

  const updateData: Record<string, string | null> = {
    clock_in: clockIn,
    clock_out: clockOut,
  };
  if (memo !== undefined) updateData.memo = memo;

  const { error } = await adminClient
    .from("attendances")
    .update(updateData)
    .eq("id", attendanceId);

  if (error) return { error: error.message };

  revalidatePath("/attendance");
  revalidatePath("/settings/members");
  return { success: true };
}

export async function createManualAttendance(
  employeeId: string,
  clockIn: string,
  clockOut: string | null,
  memo?: string,
) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id || profile.role !== "admin") {
    return { error: "권한이 없습니다" };
  }

  const { data: target } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", employeeId)
    .single();

  if (!target || target.company_id !== profile.company_id) {
    return { error: "같은 회사의 멤버가 아닙니다" };
  }

  const { error } = await adminClient
    .from("attendances")
    .insert({
      employee_id: employeeId,
      company_id: profile.company_id,
      clock_in: clockIn,
      clock_out: clockOut,
      ...(memo ? { memo } : {}),
    });

  if (error) return { error: error.message };

  revalidatePath("/attendance");
  revalidatePath("/settings/members");
  return { success: true };
}

export async function deleteAttendance(attendanceId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id || profile.role !== "admin") {
    return { error: "권한이 없습니다" };
  }

  const { data: attendance } = await adminClient
    .from("attendances")
    .select("company_id")
    .eq("id", attendanceId)
    .single();

  if (!attendance || attendance.company_id !== profile.company_id) {
    return { error: "삭제 권한이 없습니다" };
  }

  const { error } = await adminClient
    .from("attendances")
    .delete()
    .eq("id", attendanceId);

  if (error) return { error: error.message };

  revalidatePath("/attendance");
  revalidatePath("/settings/members");
  return { success: true };
}
