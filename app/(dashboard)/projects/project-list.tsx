"use client";

import { useState } from "react";
import Link from "next/link";
import CreateProjectModal from "./create-project-modal";
import { deleteProject, updateProjectStatus } from "./actions";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";

interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface ProjectMember {
  name: string;
  avatarUrl: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: string;
  members: ProjectMember[];
  taskCount: number;
  progressPercent: number;
  createdAt: string;
}

interface Props {
  projects: Project[];
  members: Member[];
}

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-white/20", text: "text-white", dot: "bg-blue-400" },
  completed: { bg: "bg-white/20", text: "text-white", dot: "bg-green-400" },
  on_hold: { bg: "bg-white/20", text: "text-white", dot: "bg-gray-400" },
};

const defaultGradients = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-orange-400 to-rose-500",
  "from-pink-500 to-rose-600",
];

export default function ProjectList({ projects, members }: Props) {
  const t = useT();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const statusLabels: Record<string, string> = {
    active: t("projects.active"),
    completed: t("projects.completed"),
    on_hold: t("projects.onHold"),
  };

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  async function handleDelete(projectId: string) {
    if (!(await confirmDialog({ message: t("projects.deleteConfirm"), danger: true }))) return;
    const result = await deleteProject(projectId);
    if (result?.error) toast.error(result.error);
    setMenuOpen(null);
  }

  async function handleStatusChange(projectId: string, status: string) {
    const result = await updateProjectStatus(projectId, status);
    if (result?.error) toast.error(result.error);
    setMenuOpen(null);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">{t("projects.title")}</h1>
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
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white transition-all duration-200 ease-spring hover:bg-blue-600 shadow-soft-sm active:scale-[0.98] hover:shadow-brand"
          >
            {t("projects.new")}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white">
            <p className="text-sm text-gray-600">
              {projects.length === 0 ? t("projects.empty") : t("projects.emptyFiltered")}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project, idx) => {
            const sc = statusStyles[project.status] || statusStyles.active;
            const gradient = defaultGradients[idx % defaultGradients.length];
            return (
              <div key={project.id} className="group relative aspect-[4/3] overflow-hidden rounded-2xl">
                {/* 배경: 이미지 or 그라데이션 */}
                {project.imageUrl ? (
                  <img
                    src={project.imageUrl}
                    alt={project.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
                  </div>
                )}

                {/* 하단 자연스러운 어둠 그라데이션 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                {/* 상태 뱃지 */}
                <div className="pointer-events-none absolute top-3 left-3 z-10">
                  <span className={`inline-flex items-center gap-1.5 rounded-full ${sc.bg} px-2.5 py-1 text-[11px] font-medium ${sc.text} backdrop-blur-md`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                    {statusLabels[project.status] || statusLabels.active}
                  </span>
                </div>

                {/* 메뉴 버튼 */}
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(menuOpen === project.id ? null : project.id); }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white/80 backdrop-blur-md transition-colors hover:bg-white/25 hover:text-white"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  {menuOpen === project.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                      <div className="absolute top-full right-0 z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1">
                        {project.status !== "active" && (
                          <button onClick={() => handleStatusChange(project.id, "active")} className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50">
                            {t("projects.changeToActive")}
                          </button>
                        )}
                        {project.status !== "completed" && (
                          <button onClick={() => handleStatusChange(project.id, "completed")} className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50">
                            {t("projects.changeToCompleted")}
                          </button>
                        )}
                        {project.status !== "on_hold" && (
                          <button onClick={() => handleStatusChange(project.id, "on_hold")} className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50">
                            {t("projects.changeToOnHold")}
                          </button>
                        )}
                        <hr className="my-1 border-gray-100" />
                        <button onClick={() => handleDelete(project.id)} className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50">
                          {t("common.delete")}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* 하단 콘텐츠 - 그라데이션 위에 바로 배치 */}
                <Link href={`/projects/${project.id}`} className="absolute inset-0 flex flex-col justify-end">
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-white line-clamp-1">{project.name}</h3>
                    {project.description && (
                      <p className="mt-1 text-sm text-white/70 line-clamp-2">{project.description}</p>
                    )}
                    <div className="mt-2">
                      <span className="text-xs text-white/50">
                        {project.members.length > 0 && `${project.members.length}${t("projects.members")} · `}{project.taskCount}{t("projects.tasks")}
                      </span>
                    </div>
                    {/* 진행도 */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full rounded-full bg-white transition-all duration-500"
                          style={{ width: `${project.progressPercent}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-white/90 tabular-nums">{project.progressPercent}%</span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <CreateProjectModal members={members} onClose={() => setShowModal(false)} />}
    </>
  );
}
