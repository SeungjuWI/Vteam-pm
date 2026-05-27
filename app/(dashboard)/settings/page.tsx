import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("name, email, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return (
    <div className="rounded-xl bg-white p-6">
      <h2 className="mb-4 text-sm font-medium text-gray-900">내 프로필</h2>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">이름</span>
          <span className="text-sm text-gray-900">{profile.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">이메일</span>
          <span className="text-sm text-gray-900">{profile.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">역할</span>
          <span className="text-sm text-gray-900">{profile.role === "manager" ? "관리자" : "직원"}</span>
        </div>
      </div>
    </div>
  );
}
