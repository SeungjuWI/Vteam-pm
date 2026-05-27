import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DashboardShell from "./dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, status")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) redirect("/onboarding");
  if (profile.status === "setup") redirect("/welcome");
  if (profile.status === "pending") redirect("/pending");

  const { data: roleData } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return <DashboardShell role={roleData?.role ?? "employee"}>{children}</DashboardShell>;
}
