import { redirect } from "next/navigation";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import { getAttendanceDashboardData } from "./actions";
import AttendanceDashboardView from "./attendance-dashboard-view";

export default async function AttendanceDashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile || (profile.role !== "manager" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  const data = await getAttendanceDashboardData();
  if (!data) redirect("/dashboard");

  return <AttendanceDashboardView data={data} />;
}
