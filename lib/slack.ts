import type { SupabaseClient } from "@supabase/supabase-js";
import { kstTodayString } from "@/lib/date";

export type OverdueItem = {
  title: string;
  projectName: string;
  dueDate: string;
  daysOverdue: number;
  owners: string[];
};

// 한 회사의 지연 업무(마감일이 오늘보다 이전 + 미완료)를 모아서 반환.
export async function getCompanyOverdue(
  adminClient: SupabaseClient,
  companyId: string,
): Promise<OverdueItem[]> {
  const today = kstTodayString();
  const todayMid = new Date(today + "T00:00:00+09:00").getTime();

  // 활성 프로젝트
  const { data: projRows } = await adminClient
    .from("projects")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("status", "active");
  const projects = projRows ?? [];
  if (projects.length === 0) return [];
  const projName = new Map(projects.map((p) => [p.id, p.name as string]));

  // 미완료 + 마감일이 오늘 이전인 태스크 = 지연
  const { data: taskRows } = await adminClient
    .from("tasks")
    .select("id, title, due_date, project_id")
    .in("project_id", projects.map((p) => p.id))
    .neq("status", "done")
    .not("due_date", "is", null)
    .lt("due_date", today)
    .order("due_date", { ascending: true });
  const tasks = taskRows ?? [];
  if (tasks.length === 0) return [];

  // 담당자 이름
  const { data: members } = await adminClient
    .from("profiles")
    .select("id, name")
    .eq("company_id", companyId);
  const memberName = new Map((members ?? []).map((m) => [m.id, m.name as string]));

  const { data: taData } = await adminClient
    .from("task_assignees")
    .select("task_id, member_id")
    .in("task_id", tasks.map((t) => t.id));
  const ownersByTask = new Map<string, string[]>();
  for (const ta of taData ?? []) {
    const name = memberName.get(ta.member_id);
    if (!name) continue;
    const arr = ownersByTask.get(ta.task_id) ?? [];
    arr.push(name);
    ownersByTask.set(ta.task_id, arr);
  }

  return tasks.map((t) => {
    const dueMid = new Date((t.due_date as string) + "T00:00:00+09:00").getTime();
    return {
      title: t.title as string,
      projectName: projName.get(t.project_id) ?? "",
      dueDate: t.due_date as string,
      daysOverdue: Math.round((todayMid - dueMid) / 86400000),
      owners: ownersByTask.get(t.id) ?? [],
    };
  });
}

// 지연 업무 목록을 슬랙 메시지(text)로 구성.
export function buildDigestText(companyName: string, items: OverdueItem[]): string {
  const lines: string[] = [
    `:rotating_light: *${companyName} — 지연된 업무 ${items.length}건*`,
    "마감일이 지난 업무예요. 오늘 마무리 부탁드립니다 :pray:",
    "",
  ];
  for (const it of items) {
    const who = it.owners.length > 0 ? it.owners.join(", ") : "담당자 없음";
    const proj = it.projectName ? `[${it.projectName}] ` : "";
    lines.push(`• ${proj}${it.title} — *${it.daysOverdue}일 지연* (마감 ${it.dueDate}) · ${who}`);
  }
  return lines.join("\n");
}

// 슬랙 Incoming Webhook 으로 전송. 성공 여부 반환.
export async function postToSlack(webhookUrl: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
