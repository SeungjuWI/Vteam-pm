import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAttendanceDashboardData } from "./actions";
import AttendanceDashboardView from "./attendance-dashboard-view";

export default async function AttendanceDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "manager" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  const data = await getAttendanceDashboardData();
  if (!data) redirect("/dashboard");

  return <AttendanceDashboardView data={data} />;
}
