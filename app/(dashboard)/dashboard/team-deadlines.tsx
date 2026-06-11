"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useT } from "@/lib/i18n";

export type DeadlineTask = {
  id: string;
  title: string;
  dueDate: string;
  days: number; // 음수=지연, 0=오늘, 양수=남은 일수
  bucket: "overdue" | "soon" | "upcoming";
  assignees: { name: string; avatarUrl: string | null }[];
};
export type DeadlineGroup = {
  projectId: string;
  projectName: string;
  tasks: DeadlineTask[];
};

function Badge({ task, t }: { task: DeadlineTask; t: ReturnType<typeof useT> }) {
  if (task.bucket === "overdue") {
    return <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">{Math.abs(task.days)}{t("dashboard.daysOverdue")}</span>;
  }
  if (task.days === 0) {
    return <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">{t("dashboard.dDay")}</span>;
  }
  const tone = task.bucket === "soon" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>D-{task.days}</span>;
}

function Avatars({ assignees, t }: { assignees: DeadlineTask["assignees"]; t: ReturnType<typeof useT> }) {
  if (assignees.length === 0) return <span className="text-[11px] text-gray-300">{t("dashboard.noOwner")}</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {assignees.slice(0, 3).map((a, i) => (
          <span key={i} className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[9px] font-medium text-gray-500 ring-2 ring-white" title={a.name}>
            {a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" /> : a.name[0]}
          </span>
        ))}
      </div>
      <span className="text-[11px] text-gray-500">{assignees.length === 1 ? assignees[0].name : `${assignees[0].name} 외 ${assignees.length - 1}`}</span>
    </div>
  );
}

export default function TeamDeadlines({ groups }: { groups: DeadlineGroup[] }) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);

  // 총 지연/임박 건수
  const urgentCount = groups.reduce((n, g) => n + g.tasks.filter((x) => x.bucket !== "upcoming").length, 0);

  // 표시할 그룹: 토글에 따라 upcoming 포함/제외
  const shown = groups
    .map((g) => ({ ...g, tasks: showAll ? g.tasks : g.tasks.filter((x) => x.bucket !== "upcoming") }))
    .filter((g) => g.tasks.length > 0);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{t("dashboard.teamDeadlines")}</h2>
          {urgentCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{urgentCount}</span>}
        </div>
        <button onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-gray-400 hover:text-blue-500">
          {showAll ? t("dashboard.showUrgentOnly") : t("dashboard.showAllDeadlines")}
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-300">{t("dashboard.noDeadlineTasks")}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {shown.map((g) => (
            <div key={g.projectId}>
              <Link href={`/projects/${g.projectId}`} className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-blue-500">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />{g.projectName}
              </Link>
              <div className="flex flex-col divide-y divide-gray-50">
                {g.tasks.map((task) => (
                  <Link key={task.id} href={`/projects/${g.projectId}`} className="flex items-center gap-3 py-2 transition-colors hover:bg-gray-50/60">
                    <Badge task={task} t={t} />
                    <span className={`flex-1 truncate text-sm ${task.bucket === "overdue" ? "font-medium text-gray-900" : "text-gray-700"}`}>{task.title}</span>
                    <span className="shrink-0 text-[11px] text-gray-300">{task.dueDate.slice(5).replace("-", "/")}</span>
                    <Avatars assignees={task.assignees} t={t} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
