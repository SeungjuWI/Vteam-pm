import { redirect } from "next/navigation";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import ExportView from "./export-view";

export default async function ExportPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile || (profile.role !== "manager" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  return <ExportView />;
}
