import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuperAdmin } from "@/lib/auth/super-admin";

export const dynamic = "force-dynamic";

// 활성 판정 기준 (일)
const ACTIVE_DAYS = 7;

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "활동 없음";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${Math.max(min, 0)}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

export default async function AdminPage() {
  // 작업 2 — 보안 게이트: 운영자(슈퍼어드민)가 아니면 입장 불가
  const operator = await getSuperAdmin();
  if (!operator) redirect("/attendance");

  const adminClient = createAdminClient();

  // 회사 전체
  const { data: companies } = await adminClient
    .from("companies")
    .select("id, name, created_at, created_by")
    .order("created_at", { ascending: false });

  // 전체 멤버 (봇 제외)
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, name, email, role, status, company_id")
    .neq("is_bot", true);

  // 최근 30일 출퇴근 → 회사별 마지막 활동 계산용
  const { data: attendances } = await adminClient
    .from("attendances")
    .select("company_id, clock_in")
    .gte("clock_in", daysAgo(30))
    .order("clock_in", { ascending: false });

  // 회사별 마지막 활동(clock_in) 맵 — 정렬돼 있으므로 첫 등장이 최신
  const lastActivity = new Map<string, string>();
  for (const a of attendances ?? []) {
    if (a.company_id && !lastActivity.has(a.company_id)) {
      lastActivity.set(a.company_id, a.clock_in);
    }
  }

  const activeThreshold = new Date(daysAgo(ACTIVE_DAYS)).getTime();

  const rows = (companies ?? []).map((c) => {
    const members = (profiles ?? []).filter((p) => p.company_id === c.id);
    const owner =
      members.find((m) => m.id === c.created_by) ??
      members.find((m) => m.role === "admin") ??
      null;
    const last = lastActivity.get(c.id) ?? null;
    const isActive = last ? new Date(last).getTime() >= activeThreshold : false;
    return {
      id: c.id,
      name: c.name,
      createdAt: c.created_at,
      memberCount: members.length,
      owner,
      lastActivity: last,
      isActive,
    };
  });

  // 상단 요약
  const totalCompanies = rows.length;
  const totalUsers = (profiles ?? []).length;
  const weekAgo = new Date(daysAgo(7)).getTime();
  const newThisWeek = rows.filter((r) => new Date(r.createdAt).getTime() >= weekAgo).length;
  const dormant = rows.filter((r) => !r.isActive).length;

  return (
    <div>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">가입현황</h1>
          <p className="mt-1 text-sm text-gray-500">
            운영자 전용 — Vteam을 도입한 기업 현황 ({operator.email})
          </p>
        </div>

        {/* 상단 요약 */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="가입 회사" value={`${totalCompanies}곳`} />
          <SummaryCard label="전체 사용자" value={`${totalUsers}명`} />
          <SummaryCard label="이번 주 신규" value={`+${newThisWeek}`} accent="blue" />
          <SummaryCard label="휴면 회사" value={`${dormant}곳`} accent="amber" />
        </div>

        {/* 회사 목록 */}
        <div className="overflow-hidden rounded-xl bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-medium text-gray-900">
              회사 목록 <span className="ml-1 text-gray-400">{totalCompanies}</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-6 py-3 font-medium">회사명</th>
                  <th className="px-6 py-3 font-medium">가입일</th>
                  <th className="px-6 py-3 font-medium">멤버</th>
                  <th className="px-6 py-3 font-medium">관리자 (연락처)</th>
                  <th className="px-6 py-3 font-medium">최근 활동</th>
                  <th className="px-6 py-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                      아직 가입한 회사가 없습니다.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="text-gray-700">
                    <td className="px-6 py-4 font-medium text-gray-900">{r.name}</td>
                    <td className="px-6 py-4 text-gray-500">{fmtDate(r.createdAt)}</td>
                    <td className="px-6 py-4 text-gray-500">{r.memberCount}명</td>
                    <td className="px-6 py-4">
                      {r.owner ? (
                        <div>
                          <p className="text-gray-900">{r.owner.name}</p>
                          <p className="text-xs text-gray-400">{r.owner.email}</p>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{fmtRelative(r.lastActivity)}</td>
                    <td className="px-6 py-4">
                      {r.isActive ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] text-green-600">
                          활성
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-600">
                          휴면
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-400">
          ※ 상태는 최근 {ACTIVE_DAYS}일 내 출퇴근 활동 기준입니다. 휴면 회사는 추가 안내 대상입니다.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "blue" | "amber";
}) {
  const valueColor =
    accent === "blue" ? "text-blue-600" : accent === "amber" ? "text-amber-600" : "text-gray-900";
  return (
    <div className="rounded-xl bg-white px-5 py-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}
