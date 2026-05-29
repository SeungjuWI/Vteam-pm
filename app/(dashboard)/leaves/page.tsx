import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import LeaveRequestForm from "./leave-request-form";
import LeaveActions from "./leave-actions";
import Avatar from "@/components/avatar";
import { getT } from "@/lib/i18n/server";

const TYPE_KEYS: Record<string, string> = {
  annual: "leaveType.annual", half_am: "leaveType.half_am", half_pm: "leaveType.half_pm", sick: "leaveType.sick",
  condolence: "leaveType.condolence", maternity: "leaveType.maternity", paternity: "leaveType.paternity",
  family_care: "leaveType.family_care", public_duty: "leaveType.public_duty", menstrual: "leaveType.menstrual",
  compensatory: "leaveType.compensatory", other: "leaveType.other",
};
const STATUS_CLASS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-500",
};
const STATUS_KEYS: Record<string, string> = {
  pending: "leaveStatus.pending",
  approved: "leaveStatus.approved",
  rejected: "leaveStatus.rejected",
};

export default async function LeavesPage() {
  const t = await getT();
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  const adminClient = createAdminClient();

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
      <h1 className="text-lg font-semibold text-gray-900">{t("leaves.title")}</h1>

      {/* 연차 요약 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-5">
          <p className="text-xs text-gray-500">{t("leaves.totalAnnual")}</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{total}<span className="text-sm font-normal text-gray-400">{t("common.days")}</span></p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-xs text-gray-500">{t("leaves.used")}</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{used}<span className="text-sm font-normal text-gray-400">{t("common.days")}</span></p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-xs text-gray-500">{t("leaves.remaining")}</p>
          <p className="mt-1 text-lg font-semibold text-blue-500">{remaining}<span className="text-sm font-normal text-blue-300">{t("common.days")}</span></p>
        </div>
      </div>

      {/* 관리자: 승인 대기 */}
      {isManager && pendingLeaves.length > 0 && (
        <div className="rounded-xl bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-medium text-gray-900">
              {t("leaves.pending")} <span className="ml-1 text-blue-500">{pendingLeaves.length}</span>
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
                      {t(TYPE_KEYS[leave.type] as any)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {leave.start_date} {leave.start_time} ~ {leave.end_date} {leave.end_time}
                    {" · "}{leave.duration_hours}{t("common.hours")}
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
          <h2 className="text-sm font-medium text-gray-900">{t("leaves.history")}</h2>
        </div>
        {(!myLeaves || myLeaves.length === 0) ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-gray-400">{t("leaves.noHistory")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {myLeaves.map((leave) => {
              const stClass = STATUS_CLASS[leave.status] || STATUS_CLASS.pending;
              const stKey = STATUS_KEYS[leave.status] || STATUS_KEYS.pending;
              return (
                <div key={leave.id} className="flex items-center justify-between px-6 py-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        {t(TYPE_KEYS[leave.type] as any)}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${stClass}`}>
                        {t(stKey as any)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {leave.start_date} {leave.start_time} ~ {leave.end_date} {leave.end_time}
                    </p>
                    {leave.reason && <p className="mt-0.5 text-xs text-gray-400">{leave.reason}</p>}
                  </div>
                  <p className="text-sm text-gray-700">{leave.duration_hours}{t("common.hours")}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
