import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getProfile } from "@/lib/supabase/auth-cache";
import { kstStartOfToday, kstAddDays } from "@/lib/date";
import TeamTimeline from "../attendance/team-timeline";
import Board from "./board";
import TeamDeadlines, { type DeadlineGroup, type DeadlineTask, type DeadlineMain } from "./team-deadlines";
import { translateTasks } from "@/lib/translate-tasks";
import { getT } from "@/lib/i18n/server";

export default async function DashboardPage() {
  const t = await getT();
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();
  if (!profile?.company_id) return null;

  const adminClient = createAdminClient();

  const todayStart = kstStartOfToday();
  const todayEnd = kstAddDays(new Date(), 1);
  const [
    { data: teamTodayRaw, error: teamError },
    { count },
    { data: projRows },
    { data: companyMembers },
  ] = await Promise.all([
    adminClient
      .from("attendances")
      .select("id, employee_id, clock_in, clock_out, profiles!attendances_employee_id_fkey(name, email, avatar_url, position)")
      .eq("company_id", profile.company_id)
      .gte("clock_in", todayStart.toISOString())
      .lt("clock_in", todayEnd.toISOString())
      .order("clock_in", { ascending: true }),
    adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .neq("is_bot", true),
    adminClient
      .from("projects")
      .select("id, name")
      .eq("company_id", profile.company_id)
      .eq("status", "active"),
    adminClient
      .from("profiles")
      .select("id, name, avatar_url, position, status, is_bot")
      .eq("company_id", profile.company_id),
  ]);

  if (teamError) console.error("team query error:", teamError);

  // 팀 전체 마감 현황: 회사 내 미완료 + 마감일 있는 태스크를 프로젝트별로 묶고 지연/임박 표시
  const todayMid = kstStartOfToday().getTime();
  const dueInfo = (due: string): { days: number; bucket: DeadlineTask["bucket"] } => {
    const dueMid = new Date(due + "T00:00:00+09:00").getTime();
    const days = Math.round((dueMid - todayMid) / 86400000);
    return { days, bucket: days < 0 ? "overdue" : days <= 3 ? "soon" : "upcoming" };
  };

  let deadlineGroups: DeadlineGroup[] = [];
  const projIds = (projRows || []).map((p) => p.id);
  if (projIds.length > 0) {
    type Row = { id: string; title: string; description: string | null; output: string | null; due_date: string | null; project_id: string; parent_task_id: string | null; source_language: string | null };
    const taskCols = "id, title, description, output, due_date, project_id, parent_task_id, source_language";

    const { data: dueTasks } = await adminClient
      .from("tasks")
      .select(taskCols)
      .in("project_id", projIds)
      // done(완료)·pending(펜딩=보류)은 마감 추적 제외 — 펜딩은 지연으로 잡지 않음
      .not("status", "in", "(done,pending)")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true });

    const tasks = (dueTasks || []) as Row[];
    const taskById = new Map(tasks.map((tk) => [tk.id, tk]));

    // 서브의 부모가 마감목록에 없으면(부모가 마감없음/완료) 트리 헤더용으로 별도 조회
    const orphanParentIds = [...new Set(
      tasks.filter((tk) => tk.parent_task_id && !taskById.has(tk.parent_task_id)).map((tk) => tk.parent_task_id as string),
    )];
    let parentHeaders: Row[] = [];
    if (orphanParentIds.length > 0) {
      const { data } = await adminClient.from("tasks").select(taskCols).in("id", orphanParentIds);
      parentHeaders = (data || []) as Row[];
    }

    const allRows = [...tasks, ...parentHeaders];
    const srcById = new Map(allRows.map((r) => [r.id, r]));

    // 담당자
    const assigneeMap: Record<string, { name: string; avatarUrl: string | null }[]> = {};
    const allIds = allRows.map((r) => r.id);
    if (allIds.length > 0) {
      const { data: taData } = await adminClient.from("task_assignees").select("task_id, member_id").in("task_id", allIds);
      const mById = new Map((companyMembers || []).map((m) => [m.id, m]));
      for (const ta of taData || []) {
        const m = mById.get(ta.member_id);
        if (m) (assigneeMap[ta.task_id] ||= []).push({ name: m.name, avatarUrl: m.avatar_url });
      }
    }

    // 보는 사람 언어로 제목 번역 (작성자 언어와 다를 때만, 캐시 재사용)
    const myLang = profile.language || "ko";
    const titleMap = new Map<string, string>();
    if (allRows.some((r) => (r.source_language || "ko") !== myLang)) {
      const tr = await translateTasks(
        adminClient,
        allRows.map((r) => ({ id: r.id, title: r.title, description: r.description, output: r.output, sourceLanguage: r.source_language || "ko" })),
        myLang,
      );
      for (const r of allRows) { const x = tr.get(r.id); if (x) titleMap.set(r.id, x.title); }
    }
    const titleOf = (r: Row) => titleMap.get(r.id) || r.title;

    const projName = new Map((projRows || []).map((p) => [p.id, p.name]));

    // 메인 후보 = 마감 있는 parent-null 태스크 + orphan 부모 헤더
    const mainMap = new Map<string, DeadlineMain>();
    const makeMain = (r: Row, withDue: boolean): DeadlineMain => {
      const info = withDue && r.due_date ? dueInfo(r.due_date) : null;
      return {
        id: r.id, title: titleOf(r),
        dueDate: withDue ? r.due_date : null,
        days: info ? info.days : null,
        bucket: info ? info.bucket : null,
        isIndex: false, // 서브 부착 후 결정
        assignees: assigneeMap[r.id] || [],
        subtasks: [],
      };
    };
    for (const tk of tasks) if (!tk.parent_task_id) mainMap.set(tk.id, makeMain(tk, true));
    for (const p of parentHeaders) if (!mainMap.has(p.id)) mainMap.set(p.id, makeMain(p, !!p.due_date));

    // 서브 부착 (부모를 못 찾으면 안전망으로 메인 승격)
    for (const tk of tasks) {
      if (!tk.parent_task_id) continue;
      const info = dueInfo(tk.due_date as string);
      const sub: DeadlineTask = { id: tk.id, title: titleOf(tk), dueDate: tk.due_date as string, days: info.days, bucket: info.bucket, assignees: assigneeMap[tk.id] || [] };
      const parent = mainMap.get(tk.parent_task_id);
      if (parent) parent.subtasks.push(sub);
      else mainMap.set(tk.id, makeMain(tk, true));
    }

    // 서브를 가진 메인은 분류(인덱스) 역할 → 마감 배지 숨김 처리용 플래그
    for (const m of mainMap.values()) m.isIndex = m.subtasks.length > 0;

    const sortKey = (m?: DeadlineMain) => (m ? Math.min(m.days ?? 9999, ...m.subtasks.map((s) => s.days), 9999) : 9999);
    const byProj: Record<string, DeadlineMain[]> = {};
    for (const m of mainMap.values()) {
      const pid = srcById.get(m.id)?.project_id;
      if (pid) (byProj[pid] ||= []).push(m);
    }
    deadlineGroups = Object.entries(byProj)
      .map(([pid, mains]) => ({ projectId: pid, projectName: projName.get(pid) || "", mains: mains.sort((a, b) => sortKey(a) - sortKey(b)) }))
      .sort((a, b) => sortKey(a.mains[0]) - sortKey(b.mains[0]));
  }

  // 상단 카드용: 마감 임박·지연 건수 + 그 일의 담당자
  const urgentItems: { assignees: { name: string; avatarUrl: string | null }[]; days: number; bucket: "overdue" | "soon" | "upcoming" }[] = [];
  for (const g of deadlineGroups) {
    for (const m of g.mains) {
      if (!m.isIndex && m.bucket && m.bucket !== "upcoming") urgentItems.push({ assignees: m.assignees, days: m.days ?? 0, bucket: m.bucket });
      for (const s of m.subtasks) if (s.bucket !== "upcoming") urgentItems.push({ assignees: s.assignees, days: s.days, bucket: s.bucket });
    }
  }
  const urgentCount = urgentItems.length;
  const urgentOwnerMap = new Map<string, { name: string; avatarUrl: string | null }>();
  for (const it of urgentItems) for (const a of it.assignees) if (!urgentOwnerMap.has(a.name)) urgentOwnerMap.set(a.name, a);
  const urgentOwners = [...urgentOwnerMap.values()];

  // 🐢 마감 리더보드: 실제 마감 지난(overdue) 일감만 담당자별 누적 지연일 순. 지연이 없으면 비움.
  const lbMap = new Map<string, { name: string; avatarUrl: string | null; count: number; days: number }>();
  for (const it of urgentItems) {
    if (it.bucket !== "overdue") continue;
    for (const a of it.assignees) {
      const e = lbMap.get(a.name) ?? { name: a.name, avatarUrl: a.avatarUrl, count: 0, days: 0 };
      e.count += 1;
      e.days += Math.abs(it.days);
      lbMap.set(a.name, e);
    }
  }
  const leaderboard = [...lbMap.values()]
    .map((e) => ({ ...e, avg: e.days / e.count }))
    // 총 지연일(합) 순 — 합이 같으면 건수 많은 순 → 그다음 평균
    .sort((a, b) => b.days - a.days || b.count - a.count || b.avg - a.avg);

  type TeamRecord = { id: string; employee_id: string; clock_in: string; clock_out: string | null; profiles: { name: string; email: string; avatar_url: string | null; position: string | null } };
  const teamToday = ((teamTodayRaw || []) as unknown as TeamRecord[]);
  const totalMembers = count || 0;

  const timelineRecords = teamToday.map((r) => ({
    name: r.profiles.name,
    email: r.profiles.email,
    avatarUrl: r.profiles.avatar_url,
    position: r.profiles.position,
    clockIn: r.clock_in,
    clockOut: r.clock_out,
  }));

  // 오늘 출근 안 찍은 활성 멤버 = 미태그
  const attendedIds = new Set(teamToday.map((r) => r.employee_id));
  const absentMembers = (companyMembers || [])
    .filter((m) => m.status === "active" && !m.is_bot && !attendedIds.has(m.id))
    .map((m) => ({ name: m.name, avatarUrl: m.avatar_url, position: m.position }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-gray-900">{t("dashboard.title")}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">{t("dashboard.todayAttendance")}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {teamToday.length}<span className="text-sm font-normal text-gray-600">/{totalMembers}{t("dashboard.persons")}</span>
          </p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">{t("dashboard.urgentTasks")}</p>
          <p className={`mt-1 text-2xl font-semibold ${urgentCount > 0 ? "text-red-600" : "text-gray-900"}`}>
            {urgentCount}<span className="text-sm font-normal text-gray-600">{t("dashboard.cases")}</span>
          </p>
        </div>
        <div className="rounded-xl bg-white p-5">
          <p className="text-sm text-gray-500">{t("dashboard.urgentOwners")}</p>
          {urgentOwners.length === 0 ? (
            <p className="mt-1 text-2xl font-semibold text-gray-900">{t("dashboard.noUrgent")}</p>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex -space-x-2">
                {urgentOwners.slice(0, 5).map((a, i) => (
                  <span key={i} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-[11px] font-medium text-gray-500 ring-2 ring-white" title={a.name}>
                    {a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" /> : a.name[0]}
                  </span>
                ))}
              </div>
              {urgentOwners.length > 5 && <span className="text-sm text-gray-600">+{urgentOwners.length - 5}</span>}
            </div>
          )}
        </div>
      </div>

      <TeamDeadlines groups={deadlineGroups} />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-4 flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-gray-900">🐢 {t("dashboard.leaderboard")}</h2>
          <span className="text-xs text-gray-600">{t("dashboard.leaderboardHint")}</span>
        </div>
        {leaderboard.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-300">{t("dashboard.noOverdueYet")}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {leaderboard.slice(0, 5).map((e, i) => (
              <div key={e.name} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                <span className="w-6 shrink-0 text-center text-base">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-xs font-medium text-gray-600">{i + 1}</span>}</span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-500" title={e.name}>
                  {e.avatarUrl ? <Image src={e.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : e.name[0]}
                </span>
                <span className={`flex-1 truncate text-sm ${i === 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>{e.name}</span>
                <span className="shrink-0 text-xs text-gray-600">{e.count}{t("dashboard.cases")}</span>
                <span className="shrink-0 whitespace-nowrap text-right text-xs font-semibold text-red-500 tabular-nums">{t("dashboard.avgPrefix")}{Math.round(e.avg)}{t("dashboard.dayUnit")} · {t("dashboard.sumPrefix")}{e.days}{t("dashboard.dayUnit")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <TeamTimeline records={timelineRecords} absentMembers={absentMembers} />

      <Board currentUserId={user.id} companyId={profile.company_id} />
    </div>
  );
}
