import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuperAdmin, getSuperAdminEmails } from "@/lib/auth/super-admin";
import { categorizeTask, type TaskCategory } from "@/lib/task-category";
import AdminTabs from "../admin-tabs";

export const dynamic = "force-dynamic";

// 무활동 판정 기준 (일)
const COOLING_DAYS = 7; // 7일+ 신규 업무 없음 = 식어가는
const CHURN_DAYS = 14; // 14일+ = 이탈 신호

function fmtRelative(iso: string | null): string {
  if (!iso) return "업무 없음";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${Math.max(min, 0)}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

const STATUS_LABEL: Record<string, string> = {
  todo: "시작전",
  in_progress: "진행중",
  pending: "펜딩",
  done: "완료",
};

export default async function InsightsPage() {
  const operator = await getSuperAdmin();
  if (!operator) redirect("/attendance");

  const adminClient = createAdminClient();
  const superEmails = new Set(getSuperAdminEmails());

  const [companiesRes, profilesRes, projectsRes, tasksRes, commentsRes] = await Promise.all([
    adminClient.from("companies").select("id, name, created_at"),
    adminClient.from("profiles").select("id, email, company_id, status, is_bot"),
    adminClient.from("projects").select("id, name, company_id"),
    adminClient.from("tasks").select("id, project_id, title, description, status, parent_task_id, created_at"),
    adminClient.from("task_comments").select("task_id, created_at"),
  ]);

  const companies = companiesRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const comments = commentsRes.data ?? [];

  // 내부(우리 likelion 운영) 회사 식별 → 제외
  const isInternalEmail = (e?: string | null) => {
    if (!e) return false;
    const low = e.toLowerCase();
    return low.endsWith("@likelion.net") || superEmails.has(low);
  };
  const internalCompanyIds = new Set(
    profiles.filter((p) => isInternalEmail(p.email)).map((p) => p.company_id).filter(Boolean)
  );

  // 매핑 준비
  const projectCompany = new Map<string, string>(); // projectId -> companyId
  const projectName = new Map<string, string>();
  for (const p of projects) {
    if (p.company_id) projectCompany.set(p.id, p.company_id);
    projectName.set(p.id, p.name);
  }
  const companyName = new Map<string, string>();
  for (const c of companies) companyName.set(c.id, c.name);

  const externalCompanies = companies.filter((c) => !internalCompanyIds.has(c.id));
  const extCompanyIds = new Set(externalCompanies.map((c) => c.id));

  // task -> company (외부 회사 태스크만)
  const taskCompany = new Map<string, string>();
  for (const t of tasks) {
    const cid = projectCompany.get(t.project_id);
    if (cid) taskCompany.set(t.id, cid);
  }
  const extTasks = tasks.filter((t) => {
    const cid = taskCompany.get(t.id);
    return cid && extCompanyIds.has(cid);
  });

  const now = Date.now();
  const sevenAgoMs = now - 7 * 86400000;

  // 회사별 집계
  const byCompany = externalCompanies
    .map((c) => {
      // 가입현황 탭과 동일 정의: 봇 제외 전원 (status 무관)
      const members = profiles.filter((p) => p.company_id === c.id && !p.is_bot).length;
      const projCount = projects.filter((p) => p.company_id === c.id).length;
      const ct = extTasks.filter((t) => taskCompany.get(t.id) === c.id);
      const count = (s: string) => ct.filter((t) => t.status === s).length;
      const new7d = ct.filter((t) => new Date(t.created_at).getTime() >= sevenAgoMs).length;

      // 마지막 업무 활동 = 태스크 생성 or 댓글 중 가장 최근
      let last = 0;
      for (const t of ct) last = Math.max(last, new Date(t.created_at).getTime());
      for (const cm of comments) {
        if (taskCompany.get(cm.task_id) === c.id) last = Math.max(last, new Date(cm.created_at).getTime());
      }
      const silentDays = last ? (now - last) / 86400000 : Infinity;
      const tier: "good" | "warn" | "bad" =
        silentDays <= COOLING_DAYS ? "good" : silentDays <= CHURN_DAYS ? "warn" : "bad";

      return {
        id: c.id,
        name: c.name,
        members,
        projCount,
        total: ct.length,
        todo: count("todo"),
        prog: count("in_progress"),
        pend: count("pending"),
        done: count("done"),
        new7d,
        lastIso: last ? new Date(last).toISOString() : null,
        tier,
      };
    })
    .sort((a, b) => b.total - a.total);

  // 상단 요약
  const totalCompanies = externalCompanies.length;
  const totalTasks = extTasks.length;
  const newTasksWeek = extTasks.filter((t) => new Date(t.created_at).getTime() >= sevenAgoMs).length;
  const coolingCount = byCompany.filter((r) => r.tier !== "good").length;

  // 업무 종류 태깅 집계
  const catCount = new Map<TaskCategory, number>();
  for (const t of extTasks) {
    const cat = categorizeTask(t.title, t.description);
    catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
  }
  const cats = [...catCount.entries()].sort((a, b) => b[1] - a[1]);

  // 최근 업무 피드 (최근 30개)
  const feed = [...extTasks]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30)
    .map((t) => ({
      company: companyName.get(taskCompany.get(t.id) ?? "") ?? "-",
      project: projectName.get(t.project_id) ?? "-",
      title: t.title,
      status: t.status,
      category: categorizeTask(t.title, t.description),
      createdAt: t.created_at,
      isSub: !!t.parent_task_id,
    }));

  return (
    <div>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">업무 인사이트</h1>
          <p className="mt-1 text-sm text-gray-500">
            운영자 전용 — 고객사가 어떤 업무를 하고, 얼마나 활발히 쓰는지 ({operator.email})
          </p>
        </div>

        <AdminTabs active="insights" />

        {/* 상단 요약 */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="고객사" value={`${totalCompanies}곳`} />
          <SummaryCard label="전체 업무" value={`${totalTasks}건`} accent="blue" />
          <SummaryCard label="이번 주 신규 업무" value={`+${newTasksWeek}`} accent="green" />
          <SummaryCard label="식어가는 회사" value={`${coolingCount}곳`} accent="amber" />
        </div>

        {/* 회사별 업무 현황 */}
        <div className="mb-6 overflow-hidden rounded-xl bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-medium text-gray-900">회사별 업무 현황</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-600">
                  <th className="px-6 py-3 font-medium">회사</th>
                  <th className="px-6 py-3 font-medium">직원</th>
                  <th className="px-6 py-3 font-medium">프로젝트</th>
                  <th className="px-6 py-3 font-medium">총 업무</th>
                  <th className="px-6 py-3 font-medium">상태 분포</th>
                  <th className="px-6 py-3 font-medium">최근 7일</th>
                  <th className="px-6 py-3 font-medium">마지막 업무</th>
                  <th className="px-6 py-3 font-medium">정착도</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byCompany.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-600">
                      아직 외부 고객사 업무 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {byCompany.map((r) => (
                  <tr key={r.id} className="text-gray-700">
                    <td className="px-6 py-4 font-medium text-gray-900">{r.name}</td>
                    <td className="px-6 py-4 text-gray-500">{r.members}명</td>
                    <td className="px-6 py-4 text-gray-500">{r.projCount}</td>
                    <td className="px-6 py-4 text-gray-500">{r.total}</td>
                    <td className="px-6 py-4">
                      <StatusBar todo={r.todo} prog={r.prog} pend={r.pend} done={r.done} />
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {r.new7d > 0 ? `+${r.new7d}` : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{fmtRelative(r.lastIso)}</td>
                    <td className="px-6 py-4">
                      <TierBadge tier={r.tier} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-6 py-3 text-xs text-gray-500">
            <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-gray-300 align-middle" />시작전
            <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-sm bg-blue-400 align-middle" />진행중
            <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400 align-middle" />펜딩
            <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-400 align-middle" />완료
            &nbsp; · &nbsp; 정착도 = 마지막 업무 활동 기준 (7일 이내 정착 / 7~14일 관찰 / 14일+ 이탈 신호)
          </p>
        </div>

        {/* 업무 종류 */}
        <div className="mb-6 overflow-hidden rounded-xl bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-medium text-gray-900">
              어떤 종류의 업무를 하나 <span className="ml-1 font-normal text-gray-400">키워드 자동 태깅</span>
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 px-6 py-4">
            {cats.length === 0 && <span className="text-sm text-gray-400">데이터 없음</span>}
            {cats.map(([cat, n]) => (
              <span
                key={cat}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700"
              >
                {cat} <span className="font-semibold text-gray-900">{n}</span>
              </span>
            ))}
          </div>
        </div>

        {/* 최근 업무 피드 */}
        <div className="overflow-hidden rounded-xl bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-medium text-gray-900">
              최근 올라온 업무 <span className="ml-1 font-normal text-gray-400">최근 {feed.length}건</span>
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {feed.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-gray-600">최근 업무가 없습니다.</div>
            )}
            {feed.map((f, i) => (
              <div key={i} className="flex items-baseline gap-3 px-6 py-3 text-sm">
                <span className="w-24 shrink-0 truncate text-gray-500">{f.company}</span>
                <span className="w-28 shrink-0 truncate text-gray-400">{f.project}</span>
                <span className="min-w-0 flex-1 truncate text-gray-900">
                  {f.isSub && <span className="mr-1 text-gray-300">└</span>}
                  {f.title}
                </span>
                <span className="shrink-0 rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-500">
                  {f.category}
                </span>
                <span className="w-14 shrink-0 text-[11px] text-gray-400">
                  {STATUS_LABEL[f.status] ?? f.status}
                </span>
                <span className="w-16 shrink-0 text-right text-[11px] text-gray-400">
                  {fmtRelative(f.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-600">
          ※ 내부(likelion 운영) 회사는 제외한 외부 고객사 데이터입니다. 업무 종류는 제목·설명의 키워드로 자동 추정한 값이라 일부 부정확할 수 있습니다.
        </p>
      </div>
    </div>
  );
}

function StatusBar({ todo, prog, pend, done }: { todo: number; prog: number; pend: number; done: number }) {
  const total = todo + prog + pend + done;
  if (total === 0) return <span className="text-gray-300">-</span>;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-2 w-32 overflow-hidden rounded-sm border border-gray-200">
      <span className="bg-gray-300" style={{ width: pct(todo) }} />
      <span className="bg-blue-400" style={{ width: pct(prog) }} />
      <span className="bg-amber-400" style={{ width: pct(pend) }} />
      <span className="bg-emerald-400" style={{ width: pct(done) }} />
    </div>
  );
}

function TierBadge({ tier }: { tier: "good" | "warn" | "bad" }) {
  if (tier === "good")
    return <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] text-green-600">정착</span>;
  if (tier === "warn")
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-600">관찰</span>;
  return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-600">이탈 신호</span>;
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "blue" | "amber" | "green";
}) {
  const valueColor =
    accent === "blue"
      ? "text-blue-600"
      : accent === "amber"
        ? "text-amber-600"
        : accent === "green"
          ? "text-emerald-600"
          : "text-gray-900";
  return (
    <div className="rounded-xl bg-white px-5 py-4">
      <p className="text-xs text-gray-600">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}
