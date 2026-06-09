"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import CreateProjectModal from "./create-project-modal";
import { deleteProject, reorderProjects } from "./actions";
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

  const [items, setItems] = useState(projects);
  useEffect(() => { setItems(projects); }, [projects]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const dragId = useRef<string | null>(null);
  const dragged = useRef(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

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

  function onDragEnter(targetId: string) {
    const from = dragId.current;
    if (!from || from === targetId) return;
    setItems((prev) => {
      const arr = [...prev];
      const fi = arr.findIndex((x) => x.id === from);
      const ti = arr.findIndex((x) => x.id === targetId);
      if (fi < 0 || ti < 0) return prev;
      const [m] = arr.splice(fi, 1);
      arr.splice(ti, 0, m);
      return arr;
    });
  }
  function onDragEnd() {
    dragId.current = null;
    setDraggingId(null);
    startTx(async () => { await reorderProjects(itemsRef.current.map((i) => i.id)); });
  }
  function navigate(id: string) {
    if (dragged.current) { dragged.current = false; return; }
    router.push(`/projects/${id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{t("projects.title")}</h1>
        <button onClick={() => setShowModal(true)} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600">
          {t("projects.new")}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-white py-20">
          <p className="text-sm text-gray-400">{t("projects.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p, idx) => (
            <div
              key={p.id}
              draggable={isAdmin}
              onDragStart={() => { dragId.current = p.id; dragged.current = true; setDraggingId(p.id); }}
              onDragEnter={() => onDragEnter(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={onDragEnd}
              onClick={() => navigate(p.id)}
              className={`group relative flex h-56 cursor-pointer flex-col justify-between overflow-hidden rounded-3xl p-6 transition-all hover:ring-4 hover:ring-blue-100 ${draggingId === p.id ? "opacity-40" : ""}`}
            >
              {/* 배경: 이미지(흐린 채움 + 원본 통째로) or 그라데이션 */}
              {p.imageUrl ? (
                <>
                  <Image src={p.imageUrl} alt="" fill sizes="(max-width:1024px) 50vw, 33vw" className="scale-110 object-cover blur-2xl" />
                  <Image src={p.imageUrl} alt={p.name} fill sizes="(max-width:1024px) 50vw, 33vw" className="object-contain p-3 transition-transform duration-500 group-hover:scale-105" />
                </>
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${accents[idx % accents.length]}`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/45" />

              {isAdmin && (
                <button
                  onClick={(e) => handleDelete(e, p)}
                  disabled={pending}
                  title={t("common.delete")}
                  className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white/80 backdrop-blur-md transition-all hover:bg-white/30 hover:text-white disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
              )}

              <div className="relative z-10">
                <h3 className="text-2xl font-semibold tracking-tight text-white drop-shadow-sm">{p.name}</h3>
                <div className="mt-2 flex items-center gap-2">
                  {p.members.length > 0 ? (
                    <>
                      <div className="flex -space-x-2">
                        {p.members.slice(0, 4).map((m, i) => (
                          <span key={i} className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white/20 text-[11px] font-medium text-white ring-2 ring-white/40 backdrop-blur-sm">
                            {m.avatarUrl ? <Image src={m.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : m.name[0]}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-white/70">{p.members.length}{t("projects.members")}</span>
                    </>
                  ) : (
                    <span className="text-xs text-white/50">{t("projects.noMembers")}</span>
                  )}
                </div>
              </div>

              <div className="relative z-10 flex items-end justify-between">
                {p.nextMilestone ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-md">
                    <svg className="h-2.5 w-2.5 text-amber-300" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l9 9-9 9-9-9z" /></svg>
                    <span className="text-[11px] font-medium text-white">{p.nextMilestone.title} · {fmtDate(p.nextMilestone.date)}</span>
                  </div>
                ) : <span className="text-[11px] text-white/50">{t("matrix.noMilestone")}</span>}

                <span className="flex items-center gap-1 text-sm font-medium text-white/80 transition-colors group-hover:text-white">
                  {t("matrix.open")}
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && items.length > 1 && (
        <p className="text-center text-xs text-gray-300">카드를 드래그해 순서를 바꿀 수 있습니다</p>
      )}

      {showModal && <CreateProjectModal members={members} onClose={() => setShowModal(false)} />}
    </div>
  );
}
