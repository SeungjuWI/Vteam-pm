"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function clockIn() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return { error: "회사 정보가 없습니다" };

  // 오늘 이미 출근했는지 확인
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: existing } = await adminClient
    .from("attendances")
    .select("id")
    .eq("employee_id", user.id)
    .gte("clock_in", today.toISOString())
    .is("clock_out", null)
    .single();

  if (existing) return { error: "이미 출근 상태입니다" };

  const { error } = await adminClient
    .from("attendances")
    .insert({
      employee_id: user.id,
      company_id: profile.company_id,
      clock_in: new Date().toISOString(),
    });

  if (error) return { error: error.message };

  revalidatePath("/attendance");
}

export async function getAttendanceStatus() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: record } = await adminClient
    .from("attendances")
    .select("id, clock_in, clock_out")
    .eq("employee_id", user.id)
    .gte("clock_in", today.toISOString())
    .order("clock_in", { ascending: false })
    .limit(1)
    .single();

  if (!record) return { status: "idle" as const, clockIn: null, clockOut: null };

  if (record.clock_out) {
    return { status: "done" as const, clockIn: record.clock_in, clockOut: record.clock_out };
  }

  return { status: "working" as const, clockIn: record.clock_in, clockOut: null };
}

export async function clockOut() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: record } = await adminClient
    .from("attendances")
    .select("id")
    .eq("employee_id", user.id)
    .gte("clock_in", today.toISOString())
    .is("clock_out", null)
    .single();

  if (!record) return { error: "출근 기록이 없습니다" };

  const { error } = await adminClient
    .from("attendances")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", record.id);

  if (error) return { error: error.message };

  revalidatePath("/attendance");
}
