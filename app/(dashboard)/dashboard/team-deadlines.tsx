"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useT } from "@/lib/i18n";

type Bucket = "overdue" | "soon" | "upcoming";

export type DeadlineTask = {
  id: string;
  title: string;
  dueDate: string;
  days: number; // 음수=지연, 0=오늘, 양수=남은 일수
  bucket: Bucket;
  assignees: { name: string; avatarUrl: string | null }[];
};
export type DeadlineMain = {
  id: string;
  title: string;
  // 메인 자체 마감 정보 (마감일 없는 부모는 null → 배지 미표시, 헤더 역할만)
  dueDate: string | null;
  days: number | null;
  bucket: Bucket | null;
  // 서브를 가진 메인 = 분류(인덱스) 역할 → 마감 배지/날짜 숨김. 서브 없는 단독 메인만 일감으로 배지 표시.
  isIndex: boolean;
  assignees: { name: string; avatarUrl: string | null }[];
  subtasks: DeadlineTask[];
};
export type DeadlineGroup = {
  projectId: string;
  projectName: string;
  mains: DeadlineMain[];
};

const isUrgent = (b: Bucket | null) => b !== null && b !== "upcoming";

function Badge({ bucket, days, t }: { bucket: Bucket; days: number; t: ReturnType<typeof useT> }) {
  if (bucket === "overdue") {
    return <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">{Math.abs(days)}{t("dashboard.daysOverdue")}</span>;
  }
  if (days === 0) {
    return <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">{t("dashboard.dDay")}</span>;
  }
  const tone = bucket === "soon" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>D-{days}</span>;
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

function dueLabel(due: string) {
  return due.slice(5).replace("-", "/");
}

export default function TeamDeadlines({ groups }: { groups: DeadlineGroup[] }) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);

  const urgentCount = groups.reduce(
    (n, g) => n + g.mains.reduce((m, mt) => m + (!mt.isIndex && isUrgent(mt.bucket) ? 1 : 0) + mt.subtasks.filter((s) => isUrgent(s.bucket)).length, 0),
    0,
  );

  // 토글에 따라 upcoming 숨김. 인덱스 메인은 급한 서브가 있을 때만, 단독 메인은 자신이 급할 때 노출
  const shown = groups
    .map((g) => ({
      ...g,
      mains: g.mains
        .map((m) => ({ ...m, subtasks: showAll ? m.subtasks : m.subtasks.filter((s) => isUrgent(s.bucket)) }))
        .filter((m) => showAll || (!m.isIndex && isUrgent(m.bucket)) || m.subtasks.length > 0),
    }))
    .filter((g) => g.mains.length > 0);

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
              <div className="flex flex-col gap-1">
                {g.mains.map((m) => (
                  <div key={m.id} className="rounded-lg">
                    {/* 메인 태스크 — 서브를 가진 메인은 분류(인덱스)라 마감 배지/날짜 숨김 */}
                    <Link href={`/projects/${g.projectId}?task=${m.id}`} className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-gray-50/60">
                      {!m.isIndex && (m.bucket ? <Badge bucket={m.bucket} days={m.days as number} t={t} /> : <span className="shrink-0 text-[11px] text-gray-300">·</span>)}
                      <span className={`flex-1 truncate text-sm font-medium ${m.isIndex ? "text-gray-500" : m.bucket === "overdue" ? "text-red-700" : "text-gray-900"}`}>{m.title}</span>
                      {!m.isIndex && m.dueDate && <span className="shrink-0 text-[11px] text-gray-300">{dueLabel(m.dueDate)}</span>}
                      <Avatars assignees={m.assignees} t={t} />
                    </Link>
                    {/* 서브 태스크 (들여쓰기) */}
                    {m.subtasks.length > 0 && (
                      <div className="ml-3 border-l border-gray-100 pl-3">
                        {m.subtasks.map((s) => (
                          <Link key={s.id} href={`/projects/${g.projectId}?task=${s.id}`} className="flex items-center gap-3 rounded-lg px-1 py-1.5 transition-colors hover:bg-gray-50/60">
                            <span className="shrink-0 text-gray-300">↳</span>
                            <Badge bucket={s.bucket} days={s.days} t={t} />
                            <span className={`flex-1 truncate text-[13px] ${s.bucket === "overdue" ? "font-medium text-gray-900" : "text-gray-600"}`}>{s.title}</span>
                            {s.dueDate && <span className="shrink-0 text-[11px] text-gray-300">{dueLabel(s.dueDate)}</span>}
                            <Avatars assignees={s.assignees} t={t} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
