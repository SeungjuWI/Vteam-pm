"use client";

import { useState } from "react";
import Link from "next/link";
import CreateProjectModal from "./create-project-modal";
import { useT } from "@/lib/i18n";

interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface CellTask {
  id: string;
  title: string;
  completion: number;
}

interface Cell {
  progress: number;
  done: number;
  total: number;
  tasks: CellTask[];
}

interface MatrixProject {
  id: string;
  name: string;
  status: string;
  overall: number;
  cells: Record<string, Cell>;
}

interface Props {
  projects: MatrixProject[];
  columns: string[];
  totals: Record<string, { progress: number; done: number; total: number }>;
  members: Member[];
  basePath?: string; // 프로젝트 상세 링크 베이스 (기본 /projects, 프리뷰는 /preview)
}

// 진행률 → 셀 색상
function cellTone(progress: number): { text: string; bar: string } {
  if (progress === 100) return { text: "text-green-600", bar: "bg-green-500" };
  if (progress > 0) return { text: "text-blue-600", bar: "bg-blue-500" };
  return { text: "text-gray-400", bar: "bg-gray-300" };
}

export default function ProjectTimelineMatrix({ projects, columns, totals, members, basePath = "/projects" }: Props) {
  const t = useT();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<{ projectId: string; col: string } | null>(null);

  function colLabel(key: string): string {
    if (key === "tbd") return t("matrix.tbd");
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
  }

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{t("projects.title")}</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
            {[
              { key: "all", label: t("projects.all") },
              { key: "active", label: t("projects.active") },
              { key: "completed", label: t("projects.completed") },
              { key: "on_hold", label: t("projects.onHold") },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f.key ? "bg-white text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
          >
            {t("projects.new")}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16">
          <p className="text-sm text-gray-400">{projects.length === 0 ? t("matrix.empty") : t("projects.emptyFiltered")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-xs font-medium text-gray-400">
                  {t("projects.title")} <span className="font-normal text-gray-300">· {t("matrix.openHint")}</span>
                </th>
                {columns.map((c) => (
                  <th key={c} className="min-w-[72px] px-2 py-3 text-center text-xs font-medium text-gray-500">
                    {colLabel(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  columns={columns}
                  colLabel={colLabel}
                  basePath={basePath}
                  selected={selected}
                  onSelect={(col) =>
                    setSelected((cur) =>
                      cur && cur.projectId === p.id && cur.col === col ? null : { projectId: p.id, col }
                    )
                  }
                />
              ))}
            </tbody>
            {Object.keys(totals).length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-100 bg-gray-50/50">
                  <td className="sticky left-0 z-10 bg-gray-50/50 px-4 py-3 text-xs font-semibold text-gray-500">
                    {t("matrix.total")}
                  </td>
                  {columns.map((c) => {
                    const cell = totals[c];
                    const tone = cellTone(cell?.progress ?? 0);
                    return (
                      <td key={c} className="px-2 py-3 text-center">
                        {cell ? (
                          <span className={`text-sm font-semibold tabular-nums ${tone.text}`}>{cell.progress}%</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {showModal && <CreateProjectModal members={members} onClose={() => setShowModal(false)} />}
    </div>
  );
}

function ProjectRow({ project, columns, colLabel, basePath, selected, onSelect }: {
  project: MatrixProject;
  columns: string[];
  colLabel: (key: string) => string;
  basePath: string;
  selected: { projectId: string; col: string } | null;
  onSelect: (col: string) => void;
}) {
  const t = useT();
  const isOpen = selected?.projectId === project.id;
  const openCell = isOpen ? project.cells[selected!.col] : null;

  return (
    <>
      <tr className="border-b border-gray-50">
        <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-normal">
          <Link href={`${basePath}/${project.id}`} className="group/link -mx-1 flex items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-blue-50">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-[15px] font-semibold text-gray-900 group-hover/link:text-blue-600">{project.name}</span>
              </div>
              <span className="mt-0.5 block text-[11px] text-gray-400 tabular-nums">
                {project.overall}% · <span className="text-blue-500 opacity-0 transition-opacity group-hover/link:opacity-100">열기</span>
              </span>
            </div>
            <svg className="h-4 w-4 shrink-0 text-gray-300 transition-all group-hover/link:translate-x-0.5 group-hover/link:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </th>
        {columns.map((c) => {
          const cell = project.cells[c];
          const isActive = isOpen && selected!.col === c;
          if (!cell) {
            return <td key={c} className="px-2 py-3 text-center text-gray-200">·</td>;
          }
          const tone = cellTone(cell.progress);
          return (
            <td key={c} className="px-1.5 py-2">
              <button
                onClick={() => onSelect(c)}
                className={`flex w-full flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors ${
                  isActive ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-gray-50"
                }`}
              >
                <span className={`text-sm font-semibold tabular-nums ${tone.text}`}>{cell.progress}%</span>
                <span className="text-[10px] text-gray-400 tabular-nums">{cell.done}/{cell.total}</span>
                <span className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
                  <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${cell.progress}%` }} />
                </span>
              </button>
            </td>
          );
        })}
      </tr>

      {/* 셀 클릭 → 그 달 메인태스크 펼침 */}
      {isOpen && openCell && (
        <tr>
          <td colSpan={columns.length + 1} className="bg-blue-50/30 px-4 py-3">
            <p className="mb-2 text-[11px] font-medium text-gray-400">
              {project.name} · {colLabel(selected!.col)} · {t("matrix.cellTitle")} {openCell.total}
            </p>
            <div className="flex flex-col gap-1">
              {openCell.tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`${basePath}/${project.id}`}
                  className="flex items-center gap-2.5 rounded-lg bg-white px-3 py-2 transition-colors hover:bg-gray-50"
                >
                  <span className={`w-9 shrink-0 text-right text-[11px] font-medium tabular-nums ${cellTone(task.completion).text}`}>
                    {task.completion}%
                  </span>
                  <span className={`text-sm ${task.completion === 100 ? "text-gray-400 line-through" : "text-gray-700"}`}>
                    {task.title}
                  </span>
                </Link>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
