"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  projects: { id: string; name: string };
}

interface Props {
  activeTasks: Task[];
  doneTasks: Task[];
  projects: { id: string; name: string }[];
  stats: { total: number; dueToday: number; overdue: number; done: number };
  today: string;
}

type StatusFilter = "all" | "todo" | "in_progress" | "done";
type SortBy = "dueDate" | "priority" | "project";

const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function MyTasksView({ activeTasks, doneTasks, projects, stats, today }: Props) {
  const t = useT();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("dueDate");

  const allTasks = useMemo(() => [...activeTasks, ...doneTasks], [activeTasks, doneTasks]);

  const filtered = useMemo(() => {
    let tasks = statusFilter === "done" ? doneTasks : statusFilter === "all" ? allTasks : activeTasks.filter((t) => t.status === statusFilter);
    if (projectFilter !== "all") tasks = tasks.filter((t) => t.projects.id === projectFilter);
    if (priorityFilter !== "all") tasks = tasks.filter((t) => t.priority === priorityFilter);

    return [...tasks].sort((a, b) => {
      if (sortBy === "dueDate") {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      if (sortBy === "priority") {
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      }
      return a.projects.name.localeCompare(b.projects.name);
    });
  }, [allTasks, activeTasks, doneTasks, statusFilter, projectFilter, priorityFilter, sortBy]);

  const priorityLabel = (p: string) =>
    p === "high" ? t("dashboard.priorityHigh") : p === "medium" ? t("dashboard.priorityMedium") : t("dashboard.priorityLow");

  const priorityColor = (p: string) =>
    p === "high" ? "bg-red-50 text-red-600" : p === "medium" ? "bg-yellow-50 text-yellow-600" : "bg-gray-50 text-gray-500";

  const statusLabel = (s: string) =>
    s === "done" ? t("myTasks.done") : s === "in_progress" ? t("myTasks.inProgress") : t("myTasks.todo");

  const statusColor = (s: string) =>
    s === "done" ? "bg-green-500" : s === "in_progress" ? "bg-blue-500" : "bg-gray-300";

  const dueBadge = (dueDate: string | null) => {
    if (!dueDate) return null;
    if (dueDate < today) return <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">{t("myTasks.overdue")}</span>;
    if (dueDate === today) return <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">{t("myTasks.dueToday")}</span>;
    const dDay = Math.ceil((new Date(dueDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    return <span className="text-xs text-gray-400">D-{dDay}</span>;
  };

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: t("myTasks.total"), count: allTasks.length },
    { key: "todo", label: t("myTasks.todo"), count: activeTasks.filter((t) => t.status === "todo").length },
    { key: "in_progress", label: t("myTasks.inProgress"), count: activeTasks.filter((t) => t.status === "in_progress").length },
    { key: "done", label: t("myTasks.done"), count: doneTasks.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-gray-900">{t("myTasks.title")}</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4">
          <p className="text-xs text-gray-500">{t("myTasks.statsTotal")}</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-xl bg-white p-4">
          <p className="text-xs text-gray-500">{t("myTasks.statsDueToday")}</p>
          <p className="mt-1 text-xl font-semibold text-orange-600">{stats.dueToday}</p>
        </div>
        <div className="rounded-xl bg-white p-4">
          <p className="text-xs text-gray-500">{t("myTasks.statsOverdue")}</p>
          <p className="mt-1 text-xl font-semibold text-red-600">{stats.overdue}</p>
        </div>
        <div className="rounded-xl bg-white p-4">
          <p className="text-xs text-gray-500">{t("myTasks.statsDone")}</p>
          <p className="mt-1 text-xl font-semibold text-green-600">{stats.done}</p>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="rounded-xl bg-white">
        <div className="flex items-center gap-1 border-b border-gray-100 px-4 pt-3">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-2 text-sm transition-colors relative ${
                statusFilter === tab.key
                  ? "text-blue-600 font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              <span className={`ml-1 text-xs ${statusFilter === tab.key ? "text-blue-400" : "text-gray-400"}`}>
                {tab.count}
              </span>
              {statusFilter === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-50">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
          >
            <option value="all">{t("myTasks.allProjects")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
          >
            <option value="all">{t("myTasks.allPriority")}</option>
            <option value="high">{t("dashboard.priorityHigh")}</option>
            <option value="medium">{t("dashboard.priorityMedium")}</option>
            <option value="low">{t("dashboard.priorityLow")}</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 ml-auto"
          >
            <option value="dueDate">{t("myTasks.sortDueDate")}</option>
            <option value="priority">{t("myTasks.sortPriority")}</option>
            <option value="project">{t("myTasks.sortProject")}</option>
          </select>
        </div>

        {/* Task List */}
        {filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-gray-400">
              {statusFilter === "done" ? t("myTasks.emptyDone") : t("myTasks.empty")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50">
            {filtered.map((task) => (
              <Link
                key={task.id}
                href={`/projects/${task.projects.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusColor(task.status)}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{task.projects.name}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{statusLabel(task.status)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColor(task.priority)}`}>
                    {priorityLabel(task.priority)}
                  </span>
                  {task.due_date ? dueBadge(task.due_date) : (
                    <span className="text-xs text-gray-300">{t("myTasks.noDue")}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
