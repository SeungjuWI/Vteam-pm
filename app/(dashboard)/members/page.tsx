import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import InviteForm from "./invite-form";
import MemberActions from "./member-actions";
import InvitationItem from "./invitation-item";
import MemberList from "./member-list";

export default async function MembersPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;

  const { data: members } = await adminClient
    .from("profiles")
    .select("id, name, email, role, status, position, avatar_url, created_at")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: true });

  const { data: invitations } = await adminClient
    .from("invitations")
    .select("id, email, created_at")
    .eq("company_id", profile.company_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const pendingMembers = members?.filter((m) => m.status === "pending" || m.status === "setup") || [];
  const activeMembers = members?.filter((m) => m.status === "active") || [];
  const isManager = profile.role === "manager" || profile.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">멤버 관리</h1>
      </div>

      {/* 초대 폼 (관리자만) */}
      {isManager && <InviteForm />}

      {/* 이메일 초대 대기 */}
      {isManager && invitations && invitations.length > 0 && (
        <div className="rounded-xl bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-medium text-gray-900">
              초대 발송됨 <span className="ml-1 text-gray-400">{invitations.length}</span>
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {invitations.map((inv) => (
              <InvitationItem key={inv.id} invitation={inv} />
            ))}
          </div>
        </div>
      )}

      {/* 온보딩 진행 중 / 승인 대기 */}
      {isManager && pendingMembers.length > 0 && (
        <div className="rounded-xl bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-medium text-gray-900">
              가입 진행 중 <span className="ml-1 text-blue-500">{pendingMembers.length}</span>
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                    {member.name?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.status === "setup" && (
                    <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[11px] text-yellow-600">프로필 설정 중</span>
                  )}
                  <MemberActions memberId={member.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 활성 멤버 */}
      <MemberList
        members={activeMembers.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, position: m.position ?? "", avatarUrl: m.avatar_url ?? "" }))}
        isManager={isManager}
      />
    </div>
  );
}
