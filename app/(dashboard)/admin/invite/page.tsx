import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuperAdmin } from "@/lib/auth/super-admin";
import InvitePanel from "./invite-panel";

export const dynamic = "force-dynamic";

export default async function AdminInvitePage() {
  const operator = await getSuperAdmin();
  if (!operator) redirect("/attendance");

  const adminClient = createAdminClient();

  const { data: companies } = await adminClient
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });

  // 회사별 멤버 수 (봇 제외)
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("company_id")
    .neq("is_bot", true);

  const memberCounts = new Map<string, number>();
  for (const p of profiles ?? []) {
    if (p.company_id) memberCounts.set(p.company_id, (memberCounts.get(p.company_id) ?? 0) + 1);
  }

  const companyOptions = (companies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    memberCount: memberCounts.get(c.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">원격 추가</h1>
        <p className="mt-1 text-sm text-gray-500">
          운영자 전용 — 워크스페이스에 이메일을 직접 추가 ({operator.email})
        </p>
      </div>

      <InvitePanel companies={companyOptions} />
    </div>
  );
}
