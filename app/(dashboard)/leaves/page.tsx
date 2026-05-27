import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import LeaveRequestForm from "./leave-request-form";
import LeaveActions from "./leave-actions";
import Avatar from "@/components/avatar";

const TYPE_LABELS: Record<string, string> = {
  annual: "연차", half_am: "오전 반차", half_pm: "오후 반차", sick: "병가",
  condolence: "경조사", maternity: "출산", paternity: "배우자출산",
  family_care: "가족돌봄", public_duty: "공가", menstrual: "생리",
  compensatory: "대체휴가", other: "기타",
};
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "대기", className: "bg-yellow-50 text-yellow-700" },
  approved: { label: "승인", className: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "거절", className: "bg-red-50 text-red-500" },
};

export default async function LeavesPage() {
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

  const isManager = profile.role === "manager";
  const year = new Date().getFullYear();

  // 내 연차 잔여
  const { data: myBalance } = await adminClient
    .from("leave_balances")
    .select("total, used")
    .eq("employee_id", user.id)
    .eq("year", year)
    .single();

  const total = Number(myBalance?.total ?? 0);
  const used = Number(myBalance?.used ?? 0);
  const remaining = total - used;

  // 내 휴가 신청 내역
  const { data: myLeaves } = await adminClient
    .from("leaves")
    .select("id, type, start_date, start_time, end_date, end_time, duration_hours, reason, status")
    .eq("employee_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // 관리자: 승인 대기
  type PendingLeave = {
    id: string; type: string; start_date: string; start_time: string;
    end_date: string; end_time: string; duration_hours: number; reason: string | null;
    profiles: { name: string; email: string; avatar_url: string | null };
  };
  let pendingLeaves: PendingLeave[] = [];
  if (isManager) {
    const { data } = await adminClient
      .from("leaves")
      .select("id, type, start_date, start_time, end_date, end_time, duration_hours, reason, profiles(name, email, avatar_url)")
      .eq("company_id", profile.company_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    pendingLeaves = ((data || []) as unknown as PendingLeave[]);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-gray-900">휴가</h1>

      {/* 연차 요약 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-5">
          <p className="text-xs text-gray-500">총 연차</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{total}<span className="text-sm font-normal text-gray-400">일</span></p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-xs text-gray-500">사용</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{used}<span className="text-sm font-normal text-gray-400">일</span></p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-xs text-gray-500">잔여</p>
          <p className="mt-1 text-lg font-semibold text-blue-500">{remaining}<span className="text-sm font-normal text-blue-300">일</span></p>
        </div>
      </div>

      {/* 관리자: 승인 대기 */}
      {isManager && pendingLeaves.length > 0 && (
        <div className="rounded-xl bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-medium text-gray-900">
              승인 대기 <span className="ml-1 text-blue-500">{pendingLeaves.length}</span>
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingLeaves.map((leave) => (
              <div key={leave.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar url={leave.profiles.avatar_url} name={leave.profiles.name} size={36} />
                  <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{leave.profiles.name}</p>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                      {TYPE_LABELS[leave.type]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {leave.start_date} {leave.start_time} ~ {leave.end_date} {leave.end_time}
                    {" · "}{leave.duration_hours}시간
                  </p>
                  {leave.reason && <p className="mt-0.5 text-xs text-gray-400">{leave.reason}</p>}
                  </div>
                </div>
                <LeaveActions leaveId={leave.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 휴가 신청 */}
      <LeaveRequestForm />

      {/* 신청 내역 */}
      <div className="rounded-xl bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-medium text-gray-900">신청 내역</h2>
        </div>
        {(!myLeaves || myLeaves.length === 0) ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-gray-400">신청 내역이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {myLeaves.map((leave) => {
              const st = STATUS_STYLES[leave.status] || STATUS_STYLES.pending;
              return (
                <div key={leave.id} className="flex items-center justify-between px-6 py-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        {TYPE_LABELS[leave.type]}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${st.className}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {leave.start_date} {leave.start_time} ~ {leave.end_date} {leave.end_time}
                    </p>
                    {leave.reason && <p className="mt-0.5 text-xs text-gray-400">{leave.reason}</p>}
                  </div>
                  <p className="text-sm text-gray-700">{leave.duration_hours}시간</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
