export interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  position: string | null;
}

export interface TaskAssignee {
  name: string;
  avatarUrl: string | null;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  output: string | null;
  progress: number;
  status: "todo" | "in_progress" | "pending" | "done";
  priority: "low" | "medium" | "high";
  assignees: TaskAssignee[];
  checklist: ChecklistItem[];
  dueDate: string | null;
  startDate: string | null;
  sortOrder?: number | null;
  createdAt?: string;
}

export interface MainTask extends Task {
  subtasks: Task[];
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: string;
  createdAt: string;
}

export type TaskStatus = "todo" | "in_progress" | "pending" | "done";

/* ── 진행도 단일 소스 ──
   타임라인 막대 · 트리 · 상세 모달이 모두 같은 값을 보이도록 한 곳에서 계산한다. */

// 단일 태스크의 유효 진행도(0–100). 완료(done)면 progress 값과 무관하게 100%.
// (체크박스로 완료 처리하면 status만 done이 되고 progress는 0으로 남을 수 있기 때문)
export function effectiveProgress(t: { status: string; progress?: number | null }): number {
  return t.status === "done" ? 100 : Math.max(0, Math.min(100, Math.round(t.progress ?? 0)));
}

// 태스크 진행도(0–100). 서브태스크가 있으면 서브들의 유효 진행도 평균, 없으면 자기 유효 진행도.
export function taskProgress(t: {
  status: string;
  progress?: number | null;
  subtasks?: { status: string; progress?: number | null }[] | null;
}): number {
  const subs = t.subtasks ?? [];
  if (subs.length > 0) return Math.round(subs.reduce((a, s) => a + effectiveProgress(s), 0) / subs.length);
  return effectiveProgress(t);
}

export const priorityConfig: Record<string, { label: string; bg: string; text: string }> = {
  high: { label: "High", bg: "bg-red-50", text: "text-red-500" },
  medium: { label: "Medium", bg: "bg-amber-50", text: "text-amber-600" },
  low: { label: "Low", bg: "bg-gray-100", text: "text-gray-500" },
};
