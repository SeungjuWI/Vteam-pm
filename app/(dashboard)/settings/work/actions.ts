"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveWorkSettings(formData: FormData) {
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

  const workType = formData.get("workType") as string;
  const fixedStart = formData.get("fixedStart") as string || null;
  const fixedEnd = formData.get("fixedEnd") as string || null;
  const flexibleStart = formData.get("flexibleStart") as string || null;
  const flexibleEnd = formData.get("flexibleEnd") as string || null;
  const requiredHours = Number(formData.get("requiredHours")) || 8;
  const lunchStart = formData.get("lunchStart") as string;
  const lunchDuration = Number(formData.get("lunchDuration")) || 60;
  const coreEnabled = formData.get("coreEnabled") === "true";
  const coreStart = formData.get("coreStart") as string || null;
  const coreEnd = formData.get("coreEnd") as string || null;

  const payload = {
    company_id: profile.company_id,
    work_type: workType,
    fixed_start: workType === "fixed" ? fixedStart : null,
    fixed_end: workType === "fixed" ? fixedEnd : null,
    flexible_start: workType === "flexible" ? flexibleStart : null,
    flexible_end: workType === "flexible" ? flexibleEnd : null,
    required_hours: requiredHours,
    lunch_start: lunchStart,
    lunch_duration: lunchDuration,
    core_time_enabled: workType === "free" ? coreEnabled : false,
    core_time_start: workType === "free" && coreEnabled ? coreStart : null,
    core_time_end: workType === "free" && coreEnabled ? coreEnd : null,
  };

  const { data: existing } = await adminClient
    .from("company_work_settings")
    .select("id")
    .eq("company_id", profile.company_id)
    .single();

  if (existing) {
    await adminClient
      .from("company_work_settings")
      .update(payload)
      .eq("id", existing.id);
  } else {
    await adminClient.from("company_work_settings").insert(payload);
  }

  revalidatePath("/settings/work");
  return { success: true };
}
