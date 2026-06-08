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

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  assignees: TaskAssignee[];
  dueDate: string | null;
}

export interface MainTask extends Task {
  subtasks: Task[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: string;
  createdAt: string;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export const priorityConfig: Record<string, { label: string; bg: string; text: string }> = {
  high: { label: "High", bg: "bg-red-50", text: "text-red-500" },
  medium: { label: "Medium", bg: "bg-amber-50", text: "text-amber-600" },
  low: { label: "Low", bg: "bg-gray-100", text: "text-gray-500" },
};
