import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { kstStartOfToday } from "@/lib/date";
import DashboardShell from "./dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile();

  if (!profile?.company_id) redirect("/onboarding");
  if (profile.status === "setup") redirect("/welcome");
  if (profile.status === "pending") redirect("/pending");

  const adminClient = createAdminClient();

  const todayStart = kstStartOfToday();

  const [companyRes, countRes, attendanceRes] = await Promise.all([
    adminClient.from("companies").select("*").eq("id", profile.company_id).single(),
    adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", profile.company_id).eq("status", "active").neq("is_bot", true),
    adminClient.from("attendances").select("id, clock_in, clock_out").eq("employee_id", user.id).gte("clock_in", todayStart.toISOString()).order("clock_in", { ascending: false }).limit(1).single(),
  ]);

  const c = companyRes.data;
  const att = attendanceRes.data;
  const initialWorkStatus = !att
    ? { status: "idle" as const, clockIn: null }
    : att.clock_out
      ? { status: "done" as const, clockIn: att.clock_in as string }
      : { status: "working" as const, clockIn: att.clock_in as string };

  const cookieStore = await cookies();
  const uiLang = cookieStore.get("vteam-ui-lang")?.value || "ko";

  return (
    <DashboardShell
      role={profile.role ?? "employee"}
      userId={user.id}
      userEmail={user.email ?? ""}
      userLang={profile.language ?? "ko"}
      uiLang={uiLang}
      profileData={{
        name: (profile.name as string) ?? "",
        role: (profile.role as string) ?? "employee",
        position: (profile.position as string) ?? "",
        avatarUrl: (profile.avatar_url as string) ?? "",
      }}
      initialWorkStatus={initialWorkStatus}
      companyData={c ? {
        name: c.name as string,
        foundedAt: (c.founded_at as string) ?? null,
        memberCount: countRes.count ?? 0,
        businessNumber: (c.business_number as string) ?? null,
        corpNumber: (c.corp_number as string) ?? null,
        phone: (c.phone as string) ?? null,
        address: (c.address as string) ?? null,
        logoUrl: (c.logo_url as string) ?? null,
      } : null}
    >
      {children}
    </DashboardShell>
  );
}
