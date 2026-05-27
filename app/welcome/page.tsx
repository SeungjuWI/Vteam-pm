import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import WelcomeForm from "./welcome-form";

export default async function WelcomePage() {
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

  if (!profile || profile.status !== "setup") redirect("/attendance");

  const { data: company } = await adminClient
    .from("companies")
    .select("name, logo_url")
    .eq("id", profile.company_id)
    .single();

  return (
    <WelcomeForm
      companyName={company?.name ?? ""}
      companyLogoUrl={company?.logo_url ?? ""}
    />
  );
}
