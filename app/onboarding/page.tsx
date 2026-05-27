import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OnboardingForm from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, status")
    .eq("id", user.id)
    .single();

  // 이미 회사 있으면 상태별 분기
  if (profile?.company_id) {
    if (profile.status === "setup") redirect("/welcome");
    if (profile.status === "pending") redirect("/pending");
    redirect("/attendance");
  }

  // 초대가 있는지 확인 → 있으면 회사 연결 후 웰컴으로
  const userEmail = user.email!.toLowerCase();
  const { data: invitation } = await adminClient
    .from("invitations")
    .select("id, company_id")
    .eq("email", userEmail)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (invitation) {
    await adminClient
      .from("profiles")
      .update({ company_id: invitation.company_id, role: "employee", status: "setup" })
      .eq("id", user.id);

    await adminClient
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id);

    redirect("/welcome");
  }

  // 초대 없음 → 회사 등록 폼
  return <OnboardingForm />;
}
