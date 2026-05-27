import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function CompanySettingsPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;

  const { data: company } = await adminClient
    .from("companies")
    .select("name, invite_code, created_at")
    .eq("id", profile.company_id)
    .single();

  const { count } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id)
    .eq("status", "active");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-900">회사 정보</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">회사명</span>
            <span className="text-sm text-gray-900">{company?.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">전체 멤버</span>
            <span className="text-sm text-gray-900">{count || 0}명</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">생성일</span>
            <span className="text-sm text-gray-900">
              {company?.created_at ? new Date(company.created_at).toLocaleDateString("ko-KR") : "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
