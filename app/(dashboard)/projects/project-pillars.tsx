"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import CreateProjectModal from "./create-project-modal";
import { deleteProject } from "./actions";
import { useT } from "@/lib/i18n";

interface Member { id: string; name: string; email: string; avatarUrl: string | null; }
interface PillarMember { name: string; avatarUrl: string | null; }
interface Project {
  id: string;
  name: string;
  status: string;
  imageUrl: string | null;
  members: PillarMember[];
  nextMilestone: { title: string; date: string } | null;
}

const accents = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-orange-400 to-rose-500",
  "from-cyan-500 to-blue-600",
  "from-pink-500 to-rose-600",
];

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

export default function ProjectPillars({ projects, members, isAdmin }: { projects: Project[]; members: Member[]; isAdmin: boolean }) {
  const t = useT();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [pending, startTx] = useTransition();

  function handleDelete(e: React.MouseEvent, p: Project) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(t("projects.deleteConfirm"))) return;
    startTx(async () => {
      const res = await deleteProject(p.id);
      if (res?.error) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{t("projects.title")}</h1>
        <button onClick={() => setShowModal(true)} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600">
          {t("projects.new")}
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="flex items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-white py-20">
          <p className="text-sm text-gray-400">{t("projects.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, idx) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group relative flex h-56 flex-col justify-between overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 transition-all hover:border-blue-200 hover:ring-4 hover:ring-blue-50"
            >
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accents[idx % accents.length]}`} />
              {isAdmin && (
                <button
                  onClick={(e) => handleDelete(e, p)}
                  disabled={pending}
                  title={t("common.delete")}
                  className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
              )}
              <div>
                <div className="flex items-center gap-3">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={p.name} width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accents[idx % accents.length]} text-lg font-semibold text-white`}>
                      {p.name[0]}
                    </div>
                  )}
                  <h3 className="text-2xl font-semibold tracking-tight text-gray-900">{p.name}</h3>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {p.members.length > 0 ? (
                    <>
                      <div className="flex -space-x-2">
                        {p.members.slice(0, 4).map((m, i) => (
                          <span key={i} className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[11px] font-medium text-gray-600 ring-2 ring-white">
                            {m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : m.name[0]}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">{p.members.length}{t("projects.members")}</span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-300">{t("projects.noMembers")}</span>
                  )}
                </div>
              </div>

              <div className="flex items-end justify-between">
                {p.nextMilestone ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1">
                    <svg className="h-2.5 w-2.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l9 9-9 9-9-9z" /></svg>
                    <span className="text-[11px] font-medium text-amber-700">{p.nextMilestone.title} · {fmtDate(p.nextMilestone.date)}</span>
                  </div>
                ) : <span className="text-[11px] text-gray-300">{t("matrix.noMilestone")}</span>}

                <span className="flex items-center gap-1 text-sm font-medium text-gray-300 transition-colors group-hover:text-blue-500">
                  {t("matrix.open")}
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && <CreateProjectModal members={members} onClose={() => setShowModal(false)} />}
    </div>
  );
}
