"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { removeProjectMember } from "../actions";
import { useT } from "@/lib/i18n";
import type { Member, MainTask, Project, Milestone } from "./project-types";
import type { Objective } from "./okr-types";
import ProjectTimeline from "./project-timeline";
import ProjectBoard from "./project-board";

const EditProjectModal = dynamic(() => import("./edit-project-modal"));
const AddMemberModal = dynamic(() => import("./add-member-modal"));
const ProjectDiscussionButton = dynamic(() => import("./project-discussion-button"));
const OkrSection = dynamic(() => import("./okr-section"));

interface Props {
  project: Project;
  members: Member[];
  allMembers: Member[];
  mainTasks: MainTask[];
  objectives: Objective[];
  milestones: Milestone[];
  currentUserId: string;
}

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
  completed: { bg: "bg-green-50", text: "text-green-600", dot: "bg-green-500" },
  on_hold: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
};

function RemoveMemberButton({ projectId, memberId, onDone }: { projectId: string; memberId: string; onDone: () => void }) {
  const t = useT();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    if (!confirm(t("tasks.removeMemberConfirm"))) return;
    setLoading(true);
    await removeProjectMember(projectId, memberId);
    onDone();
  }

  return (
    <button onClick={handleRemove} disabled={loading} className="rounded-md p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  );
}

export default function ProjectDetail({ project, members, allMembers, mainTasks, objectives, milestones, currentUserId }: Props) {
  const t = useT();
  const [view, setView] = useState<"timeline" | "board">("timeline");
  const [showOkr, setShowOkr] = useState(false);
  const sc = statusStyles[project.status] || statusStyles.active;
  const statusLabelMap: Record<string, string> = {
    active: t("projects.active"),
    completed: t("projects.completed"),
    on_hold: t("projects.onHold"),
  };

  const [showMembers, setShowMembers] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/projects" className="inline-flex w-fit items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {t("projects.backToList")}
      </Link>

      {/* 프로젝트 헤더 */}
      <div className="flex gap-5 rounded-2xl bg-white p-5">
        {project.imageUrl ? (
          <Image src={project.imageUrl} alt={project.name} width={128} height={128} className="h-32 w-32 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
            <svg className="h-10 w-10 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
        )}

        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 rounded-full ${sc.bg} px-2.5 py-0.5 text-[11px] font-medium ${sc.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                {statusLabelMap[project.status] || statusLabelMap.active}
              </span>
              <button onClick={() => setShowEdit(true)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
            </div>
            <h1 className="mt-2 text-xl font-semibold text-gray-900">{project.name}</h1>
            {project.description && <p className="mt-1 text-sm text-gray-500">{project.description}</p>}
          </div>

          <div className="relative mt-3 flex items-center gap-2">
            <button onClick={() => setShowMembers(!showMembers)} className="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-gray-50">
              {members.length > 0 ? (
                <>
                  <div className="flex -space-x-1.5">
                    {members.slice(0, 5).map((m) => (
                      <div key={m.id} className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
                        {m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : m.name[0]}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">{members.length}{t("projects.members")}</span>
                </>
              ) : (
                <span className="text-xs text-gray-400">{t("projects.noMembers")}</span>
              )}
            </button>

            <button onClick={() => setShowAddMember(true)} className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-500">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>

            <div className="ml-1 border-l border-gray-200 pl-2">
              <ProjectDiscussionButton projectId={project.id} currentUserId={currentUserId} />
            </div>

            {showMembers && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMembers(false)} />
                <div className="absolute top-full left-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white py-2">
                  <p className="px-4 pb-2 text-xs font-medium text-gray-400">{t("projects.participatingMembers")}</p>
                  {members.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">{t("projects.noParticipatingMembers")}</p>
                  ) : (
                    members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                            {m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" /> : m.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{m.name}</p>
                            <p className="text-[11px] text-gray-400">{m.position || m.email}</p>
                          </div>
                        </div>
                        <RemoveMemberButton projectId={project.id} memberId={m.id} onDone={() => setShowMembers(false)} />
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 태스크 — 마일스톤(타임라인) / 보드 토글 */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{t("tasks.title")}</h2>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
            {([
              { key: "timeline", label: t("tasks.viewTimeline") },
              { key: "board", label: t("tasks.viewBoard") },
            ] as const).map((v) => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${view === v.key ? "bg-white text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        {view === "timeline" ? (
          <ProjectTimeline projectId={project.id} mainTasks={mainTasks} members={members} allMembers={allMembers} currentUserId={currentUserId} milestones={milestones} />
        ) : (
          <ProjectBoard projectId={project.id} mainTasks={mainTasks} members={members} allMembers={allMembers} currentUserId={currentUserId} />
        )}
      </div>

      {/* OKR — 접힌 옵션 (잘 안 보지만 필요할 때 추가) */}
      <div>
        <button onClick={() => setShowOkr((v) => !v)} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">
          <svg className={`h-4 w-4 transition-transform ${showOkr ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          {t("okr.title")}
        </button>
        {showOkr && (
          <div className="mt-4">
            <OkrSection projectId={project.id} members={members} objectives={objectives} />
          </div>
        )}
      </div>

      {/* 모달들 (dynamic import) */}
      {showEdit && <EditProjectModal project={project} onClose={() => setShowEdit(false)} />}
      {showAddMember && (
        <AddMemberModal projectId={project.id} currentMemberIds={members.map((m) => m.id)} allMembers={allMembers} onClose={() => setShowAddMember(false)} />
      )}
    </div>
  );
}
