"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLE_LABELS: Record<string, string> = {
  admin: "최고관리자",
  manager: "관리자",
  employee: "직원",
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "연차",
  half_am: "오전반차",
  half_pm: "오후반차",
  sick: "병가",
  condolence: "경조사",
  maternity: "출산휴가",
  paternity: "배우자출산",
  family_care: "가족돌봄",
  public_duty: "공가",
  menstrual: "생리휴가",
  compensatory: "대체휴가",
  other: "기타",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toCSV(headers: string[], rows: string[][]) {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return "\uFEFF" + lines.join("\n"); // BOM for Excel
}

async function getAuthAndProfile() {
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

  return { adminClient, companyId: profile.company_id as string };
}

export async function exportAttendance(startDate: string, endDate: string) {
  const auth = await getAuthAndProfile();
  if (!auth) return { error: "권한이 없습니다" };

  const { adminClient, companyId } = auth;

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const { data: records } = await adminClient
    .from("attendances")
    .select("employee_id, clock_in, clock_out, memo")
    .eq("company_id", companyId)
    .gte("clock_in", start.toISOString())
    .lte("clock_in", end.toISOString())
    .order("clock_in", { ascending: true });

  const employeeIds = [...new Set(records?.map((r) => r.employee_id) ?? [])];
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, name, position")
    .in("id", employeeIds.length > 0 ? employeeIds : ["__none__"]);

  const profileMap = new Map(
    profiles?.map((p) => [p.id as string, p]) ?? [],
  );

  const headers = ["이름", "직책", "출근일시", "퇴근일시", "근무시간", "메모"];
  const rows =
    records?.map((r) => {
      const p = profileMap.get(r.employee_id as string);
      const clockIn = new Date(r.clock_in as string);
      const clockOut = r.clock_out ? new Date(r.clock_out as string) : null;
      const hours = clockOut
        ? Math.round(((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)) * 10) / 10
        : 0;
      return [
        (p?.name as string) ?? "",
        (p?.position as string) ?? "",
        formatDateTime(r.clock_in as string),
        formatDateTime(r.clock_out as string | null),
        clockOut ? `${hours}h` : "",
        (r.memo as string) ?? "",
      ];
    }) ?? [];

  return { csv: toCSV(headers, rows), filename: `근태_${startDate}_${endDate}.csv` };
}

export async function exportMembers() {
  const auth = await getAuthAndProfile();
  if (!auth) return { error: "권한이 없습니다" };

  const { adminClient, companyId } = auth;

  const { data: members } = await adminClient
    .from("profiles")
    .select("name, email, role, position, status, join_date, created_at")
    .eq("company_id", companyId)
    .order("name");

  const headers = ["이름", "이메일", "역할", "직책", "상태", "입사일"];
  const rows =
    members?.map((m) => [
      (m.name as string) ?? "",
      (m.email as string) ?? "",
      ROLE_LABELS[(m.role as string)] ?? (m.role as string),
      (m.position as string) ?? "",
      (m.status as string) === "active" ? "활성" : (m.status as string) === "pending" ? "대기" : "비활성",
      m.join_date ? formatDate(m.join_date as string) : "",
    ]) ?? [];

  return { csv: toCSV(headers, rows), filename: "멤버목록.csv" };
}

export async function exportLeaves(startDate: string, endDate: string) {
  const auth = await getAuthAndProfile();
  if (!auth) return { error: "권한이 없습니다" };

  const { adminClient, companyId } = auth;

  const { data: records } = await adminClient
    .from("leaves")
    .select("employee_id, type, start_date, end_date, duration_hours, reason, status")
    .eq("company_id", companyId)
    .gte("start_date", startDate)
    .lte("start_date", endDate)
    .order("start_date", { ascending: true });

  const employeeIds = [...new Set(records?.map((r) => r.employee_id) ?? [])];
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, name")
    .in("id", employeeIds.length > 0 ? employeeIds : ["__none__"]);

  const profileMap = new Map(
    profiles?.map((p) => [p.id as string, p]) ?? [],
  );

  const STATUS_MAP: Record<string, string> = {
    pending: "대기",
    approved: "승인",
    rejected: "반려",
  };

  const headers = ["이름", "유형", "시작일", "종료일", "시간", "사유", "상태"];
  const rows =
    records?.map((r) => {
      const p = profileMap.get(r.employee_id as string);
      return [
        (p?.name as string) ?? "",
        LEAVE_TYPE_LABELS[(r.type as string)] ?? (r.type as string),
        (r.start_date as string) ?? "",
        (r.end_date as string) ?? "",
        `${r.duration_hours}h`,
        (r.reason as string) ?? "",
        STATUS_MAP[(r.status as string)] ?? (r.status as string),
      ];
    }) ?? [];

  return { csv: toCSV(headers, rows), filename: `휴가_${startDate}_${endDate}.csv` };
}
