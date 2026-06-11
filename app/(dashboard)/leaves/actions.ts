"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";

// 연차에서 차감되는 타입
const DEDUCTS_BALANCE = new Set(["annual", "half_am", "half_pm", "family_care"]);

export async function requestLeave(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
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

  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  const diffMs = end.getTime() - start.getTime();

  if (diffMs <= 0) return { error: "종료 시간이 시작 시간보다 늦어야 합니다" };

  const durationHours = Math.round((diffMs / 3600000) * 10) / 10;

  // 연차 차감 대상일 경우 잔여 확인
  if (DEDUCTS_BALANCE.has(type)) {
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

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "권한이 없습니다" };

  const { data: leave } = await adminClient
    .from("leaves")
    .select("employee_id, duration_hours, company_id, type")
    .eq("id", leaveId)
    .single();

  if (!leave || leave.company_id !== profile.company_id) return { error: "권한이 없습니다" };

  await adminClient
    .from("leaves")
    .update({ status: "approved", reviewed_by: user.id })
    .eq("id", leaveId);

  // 연차 차감 대상만 사용일수 차감
  if (DEDUCTS_BALANCE.has(leave.type)) {
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
  }

  revalidatePath("/leaves");
}

export async function rejectLeave(leaveId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || !profile.company_id) return { error: "권한이 없습니다" };

  const { data: leave } = await adminClient.from("leaves").select("company_id").eq("id", leaveId).single();
  if (!leave || leave.company_id !== profile.company_id) return { error: "권한이 없습니다" };

  await adminClient
    .from("leaves")
    .update({ status: "rejected", reviewed_by: user.id })
    .eq("id", leaveId);

  revalidatePath("/leaves");
}

export async function adjustBalance(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || !profile.company_id) return { error: "권한이 없습니다" };

  const employeeId = formData.get("employeeId") as string;
  const total = Number(formData.get("total"));
  const year = new Date().getFullYear();

  // 대상 직원이 같은 회사인지 검증
  const { data: emp } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", employeeId)
    .single();
  if (!emp || emp.company_id !== profile.company_id) return { error: "권한이 없습니다" };

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
    await adminClient.from("leave_balances").insert({
      employee_id: employeeId,
      company_id: emp.company_id,
      year,
      total,
      used: 0,
    });
  }

  revalidatePath("/leaves");
  return { success: true };
}

// 근로기준법 기반 연차 일수 계산
function calculateAnnualDays(
  joinDate: string,
  year: number,
  defaultDays: number,
  longevityBonus: boolean,
  maxDays: number
): number {
  const join = new Date(joinDate);
  const joinYear = join.getFullYear();
  const joinMonth = join.getMonth();
  const joinDay = join.getDate();

  // 입사 연도의 경우 (1년 미만)
  const firstAnniversary = new Date(joinYear + 1, joinMonth, joinDay);
  const yearStart = new Date(year, 0, 1);

  if (firstAnniversary > yearStart && joinYear === year) {
    // 1년 미만: 매월 개근 시 1일씩 (최대 11일)
    const monthsWorked = 12 - joinMonth;
    return Math.min(monthsWorked, 11);
  }

  const yearsWorked = year - joinYear;

  if (yearsWorked < 1) return 0;

  let days = defaultDays;

  // 근속연수 가산: 3년 이상 근무 시 2년마다 1일 추가
  if (longevityBonus && yearsWorked >= 3) {
    days += Math.floor((yearsWorked - 1) / 2);
  }

  return Math.min(days, maxDays);
}

export async function saveLeaveSettings(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const user = await getClaimsUser(supabase);
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "권한이 없습니다" };

  const autoGrant = formData.get("autoGrant") === "true";
  const defaultDays = Number(formData.get("defaultDays"));
  const grantBasis = formData.get("grantBasis") as string;
  const firstYearMonthly = formData.get("firstYearMonthly") === "true";
  const longevityBonus = formData.get("longevityBonus") === "true";
  const maxAnnualDays = Number(formData.get("maxAnnualDays") || 25);
  const carryOver = formData.get("carryOver") === "true";
  const carryOverMaxDays = Number(formData.get("carryOverMaxDays") || 0);
  const annualPromotion = formData.get("annualPromotion") === "true";
  const sickLeaveDays = Number(formData.get("sickLeaveDays") || 0);
  const condolenceLeave = formData.get("condolenceLeave") !== "false";
  const maternityLeave = formData.get("maternityLeave") !== "false";
  const paternityLeave = formData.get("paternityLeave") !== "false";
  const familyCareDays = Number(formData.get("familyCareDays") || 10);

  const payload = {
    company_id: profile.company_id,
    auto_grant: autoGrant,
    default_annual_days: defaultDays,
    grant_basis: grantBasis,
    first_year_monthly: firstYearMonthly,
    longevity_bonus: longevityBonus,
    max_annual_days: maxAnnualDays,
    carry_over: carryOver,
    carry_over_max_days: carryOverMaxDays,
    annual_promotion: annualPromotion,
    sick_leave_days: sickLeaveDays,
    condolence_leave: condolenceLeave,
    maternity_leave: maternityLeave,
    paternity_leave: paternityLeave,
    family_care_days: familyCareDays,
  };

  const { data: existing } = await adminClient
    .from("company_leave_settings")
    .select("id")
    .eq("company_id", profile.company_id)
    .single();

  if (existing) {
    await adminClient
      .from("company_leave_settings")
      .update(payload)
      .eq("id", existing.id);
  } else {
    await adminClient.from("company_leave_settings").insert(payload);
  }

  // 자동 부여
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

        if (grantBasis === "join_date" && member.join_date) {
          days = calculateAnnualDays(
            member.join_date,
            year,
            defaultDays,
            longevityBonus,
            maxAnnualDays
          );
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
  revalidatePath("/settings/leave");
  return { success: true };
}
