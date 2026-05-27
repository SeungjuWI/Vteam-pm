import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import InviteForm from "./invite-form";
import MemberActions from "./member-actions";
import InvitationItem from "./invitation-item";

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
    .select("id, name, email, role, status, created_at")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: true });

  const { data: invitations } = await adminClient
    .from("invitations")
    .select("id, email, created_at")
    .eq("company_id", profile.company_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const pendingMembers = members?.filter((m) => m.status === "pending") || [];
  const activeMembers = members?.filter((m) => m.status === "active") || [];
  const isManager = profile.role === "manager";

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

      {/* 승인 대기 */}
      {isManager && pendingMembers.length > 0 && (
        <div className="rounded-xl bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-medium text-gray-900">
              가입 승인 대기 <span className="ml-1 text-blue-500">{pendingMembers.length}</span>
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
                <MemberActions memberId={member.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 활성 멤버 */}
      <div className="rounded-xl bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-medium text-gray-900">
            멤버 <span className="ml-1 text-gray-400">{activeMembers.length}</span>
          </h2>
        </div>
        {activeMembers.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-gray-400">아직 멤버가 없습니다. 이메일로 초대해보세요.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activeMembers.map((member) => (
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
                <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
                  {member.role === "manager" ? "관리자" : "직원"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
