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

// 트리(프로젝트>메인>서브)를 우선순위 평면 리스트로 펼친 한 줄 단위
type FlatItem = {
  taskId: string;
  projectId: string;
  projectName: string;
  title: string;
  dueDate: string | null;
  days: number;
  bucket: Bucket;
  assignees: { name: string; avatarUrl: string | null }[];
};

const MAX_COLLAPSED = 6;

function flatten(groups: DeadlineGroup[]): FlatItem[] {
  const items: FlatItem[] = [];
  for (const g of groups) {
    for (const m of g.mains) {
      // 인덱스(분류) 메인은 일감이 아니므로 제외 — 단독 메인만 줄로
      if (!m.isIndex && m.bucket) {
        items.push({ taskId: m.id, projectId: g.projectId, projectName: g.projectName, title: m.title, dueDate: m.dueDate, days: m.days ?? 0, bucket: m.bucket, assignees: m.assignees });
      }
      for (const s of m.subtasks) {
        items.push({ taskId: s.id, projectId: g.projectId, projectName: g.projectName, title: s.title, dueDate: s.dueDate, days: s.days, bucket: s.bucket, assignees: s.assignees });
      }
    }
  }
  // days 오름차순 = 지연(음수) → 임박 → 예정 자연 정렬
  return items.sort((a, b) => a.days - b.days);
}

function StatusBadge({ bucket, days, t }: { bucket: Bucket; days: number; t: ReturnType<typeof useT> }) {
  let label: string;
  let tone: string;
  if (bucket === "overdue") {
    label = `${Math.abs(days)}${t("dashboard.daysOverdue")}`;
    tone = "bg-red-500 text-white";
  } else if (days === 0) {
    label = t("dashboard.dDay");
    tone = "bg-amber-500 text-white";
  } else if (bucket === "soon") {
    label = `D-${days}`;
    tone = "bg-amber-50 text-amber-700";
  } else {
    label = `D-${days}`;
    tone = "bg-gray-100 text-gray-500";
  }
  return (
    <span className={`inline-flex min-w-[58px] shrink-0 items-center justify-center rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums ${tone}`}>
      {label}
    </span>
  );
}

function Avatars({ assignees, t }: { assignees: FlatItem["assignees"]; t: ReturnType<typeof useT> }) {
  if (assignees.length === 0) return <span className="shrink-0 text-[11px] text-gray-400">{t("dashboard.noOwner")}</span>;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {assignees.slice(0, 3).map((a, i) => (
          <span key={i} className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[9px] font-semibold text-gray-600 ring-2 ring-white" title={a.name}>
            {a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" /> : a.name[0]}
          </span>
        ))}
      </div>
      <span className="hidden text-xs font-medium text-gray-600 sm:inline">{assignees.length === 1 ? assignees[0].name : `${assignees[0].name} 외 ${assignees.length - 1}`}</span>
    </div>
  );
}

function dueLabel(due: string) {
  return due.slice(5).replace("-", "/");
}

function Row({ it, t }: { it: FlatItem; t: ReturnType<typeof useT> }) {
  return (
    <Link
      href={`/projects/${it.projectId}?task=${it.taskId}`}
      className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-gray-50"
    >
      <StatusBadge bucket={it.bucket} days={it.days} t={t} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold ${it.bucket === "overdue" ? "text-red-700" : "text-gray-900"}`}>{it.title}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[11px]">
          <span className="inline-flex max-w-[40%] items-center truncate rounded-md bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">{it.projectName}</span>
          {it.dueDate && <span className="tabular-nums text-gray-500">{dueLabel(it.dueDate)}</span>}
        </div>
      </div>
      <Avatars assignees={it.assignees} t={t} />
    </Link>
  );
}

export default function TeamDeadlines({ groups }: { groups: DeadlineGroup[] }) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);

  const items = flatten(groups);
  const urgentCount = items.filter((i) => i.bucket !== "upcoming").length;

  const shown = showAll ? items : items.slice(0, MAX_COLLAPSED);
  const hidden = items.length - shown.length;
  // 펼친 상태에서 '예정' 구간 시작 지점에 구분선 1회 삽입
  const firstUpcomingId = items.find((i) => i.bucket === "upcoming")?.taskId;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{t("dashboard.teamDeadlines")}</h2>
          {urgentCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
              {t("dashboard.overdue")} {urgentCount}
            </span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">{t("dashboard.noDeadlineTasks")}</p>
      ) : (
        <>
          <div className="flex flex-col">
            {shown.map((it) => (
              <div key={it.taskId}>
                {showAll && it.taskId === firstUpcomingId && (
                  <div className="my-1 flex items-center gap-2 px-2.5">
                    <span className="text-[11px] font-medium text-gray-400">{t("dashboard.dueLater")}</span>
                    <span className="h-px flex-1 bg-gray-100" />
                  </div>
                )}
                <Row it={it} t={t} />
              </div>
            ))}
          </div>

          {(hidden > 0 || showAll) && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 w-full rounded-lg py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-blue-500"
            >
              {showAll ? t("dashboard.showUrgentOnly") : `${t("dashboard.showAllDeadlines")} (+${hidden})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
