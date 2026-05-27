"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requestLeave(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return { error: "회사 정보가 없습니다" };

  const type = formData.get("type") as string;
  const startDate = formData.get("startDate") as string;
  const startTime = formData.get("startTime") as string;
  const endDate = formData.get("endDate") as string;
  const endTime = formData.get("endTime") as string;
  const reason = formData.get("reason") as string;

  if (!startDate || !startTime || !endDate || !endTime) {
    return { error: "날짜와 시간을 모두 입력해주세요" };
  }

  // 시간 계산
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  const diffMs = end.getTime() - start.getTime();

  if (diffMs <= 0) return { error: "종료 시간이 시작 시간보다 늦어야 합니다" };

  const durationHours = Math.round((diffMs / 3600000) * 10) / 10;

  // 잔여 연차 확인
  const year = new Date().getFullYear();
  const { data: balance } = await adminClient
    .from("leave_balances")
    .select("total, used")
    .eq("employee_id", user.id)
    .eq("year", year)
    .single();

  if (balance) {
    const remaining = Number(balance.total) - Number(balance.used);
    const daysNeeded = durationHours / 8;
    if (daysNeeded > remaining) {
      return { error: `잔여 연차가 부족합니다 (잔여: ${remaining}일)` };
    }
  }

  const { error } = await adminClient.from("leaves").insert({
    employee_id: user.id,
    company_id: profile.company_id,
    type,
    start_date: startDate,
    start_time: startTime,
    end_date: endDate,
    end_time: endTime,
    duration_hours: durationHours,
    reason: reason || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/leaves");
  return { success: true };
}

export async function approveLeave(leaveId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "manager") return { error: "권한이 없습니다" };

  // 연차 정보 조회
  const { data: leave } = await adminClient
    .from("leaves")
    .select("employee_id, duration_hours, company_id")
    .eq("id", leaveId)
    .single();

  if (!leave || leave.company_id !== profile.company_id) return { error: "권한이 없습니다" };

  // 승인 처리
  await adminClient
    .from("leaves")
    .update({ status: "approved", reviewed_by: user.id })
    .eq("id", leaveId);

  // 사용일수 차감
  const year = new Date().getFullYear();
  const daysUsed = Number(leave.duration_hours) / 8;

  const { data: balance } = await adminClient
    .from("leave_balances")
    .select("id, used")
    .eq("employee_id", leave.employee_id)
    .eq("year", year)
    .single();

  if (balance) {
    await adminClient
      .from("leave_balances")
      .update({ used: Number(balance.used) + daysUsed })
      .eq("id", balance.id);
  }

  revalidatePath("/leaves");
}

export async function rejectLeave(leaveId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "manager") return { error: "권한이 없습니다" };

  await adminClient
    .from("leaves")
    .update({ status: "rejected", reviewed_by: user.id })
    .eq("id", leaveId);

  revalidatePath("/leaves");
}

export async function adjustBalance(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "manager") return { error: "권한이 없습니다" };

  const employeeId = formData.get("employeeId") as string;
  const total = Number(formData.get("total"));
  const year = new Date().getFullYear();

  const { data: existing } = await adminClient
    .from("leave_balances")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .single();

  if (existing) {
    await adminClient
      .from("leave_balances")
      .update({ total })
      .eq("id", existing.id);
  } else {
    const { data: emp } = await adminClient
      .from("profiles")
      .select("company_id")
      .eq("id", employeeId)
      .single();

    await adminClient.from("leave_balances").insert({
      employee_id: employeeId,
      company_id: emp!.company_id,
      year,
      total,
      used: 0,
    });
  }

  revalidatePath("/leaves");
  return { success: true };
}

export async function saveLeaveSettings(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "manager") return { error: "권한이 없습니다" };

  const autoGrant = formData.get("autoGrant") === "true";
  const defaultDays = Number(formData.get("defaultDays"));
  const grantBasis = formData.get("grantBasis") as string;

  const { data: existing } = await adminClient
    .from("company_leave_settings")
    .select("id")
    .eq("company_id", profile.company_id)
    .single();

  if (existing) {
    await adminClient
      .from("company_leave_settings")
      .update({ auto_grant: autoGrant, default_annual_days: defaultDays, grant_basis: grantBasis })
      .eq("id", existing.id);
  } else {
    await adminClient.from("company_leave_settings").insert({
      company_id: profile.company_id,
      auto_grant: autoGrant,
      default_annual_days: defaultDays,
      grant_basis: grantBasis,
    });
  }

  // 자동 부여: 모든 active 멤버에게 올해 연차 생성
  if (autoGrant) {
    const year = new Date().getFullYear();
    const { data: members } = await adminClient
      .from("profiles")
      .select("id, join_date")
      .eq("company_id", profile.company_id)
      .eq("status", "active");

    for (const member of members || []) {
      const { data: bal } = await adminClient
        .from("leave_balances")
        .select("id")
        .eq("employee_id", member.id)
        .eq("year", year)
        .single();

      if (!bal) {
        let days = defaultDays;
        // 입사일 기반: 근속년수에 따라 추가
        if (grantBasis === "join_date" && member.join_date) {
          const joinYear = new Date(member.join_date).getFullYear();
          const yearsWorked = year - joinYear;
          if (yearsWorked >= 3) {
            days = defaultDays + Math.floor((yearsWorked - 1) / 2);
          }
        }
        await adminClient.from("leave_balances").insert({
          employee_id: member.id,
          company_id: profile.company_id,
          year,
          total: days,
          used: 0,
        });
      }
    }
  }

  revalidatePath("/leaves");
  return { success: true };
}
