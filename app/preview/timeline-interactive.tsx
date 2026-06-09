"use client";

// [DEV] A안 + 추가 동작 데모: 제목 Enter 추가 / 막대 드래그 기간조정·이동 / 빈 줄 드래그 생성.
import { useEffect, useRef, useState } from "react";

const MONTHS = ["6월", "7월", "8월", "9월", "10월"];
const N = MONTHS.length;

type Status = "todo" | "in_progress" | "done";
type Task = { id: string; title: string; start: number; end: number; status: Status };

const INIT: Task[] = [
  { id: "m1", title: "호치민 매칭위크", start: 0, end: 1, status: "in_progress" },
  { id: "m2", title: "채용 파이프라인 자동화", start: 1, end: 2, status: "in_progress" },
  { id: "m3", title: "다낭 매칭위크", start: 3, end: 4, status: "todo" },
];

const fill: Record<string, string> = { done: "bg-green-500", in_progress: "bg-blue-500", todo: "bg-gray-400" };
const barBg: Record<string, string> = { done: "bg-green-100", in_progress: "bg-blue-100", todo: "bg-gray-200" };

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function idxFromX(clientX: number, rect: DOMRect) {
  return clamp(Math.floor((clientX - rect.left) / (rect.width / N)), 0, N - 1);
}

type Drag =
  | { mode: "move" | "resize-l" | "resize-r"; id: string; rect: DOMRect; anchor: number; origStart: number; origEnd: number }
  | { mode: "create"; rect: DOMRect; anchor: number };

export default function TimelineInteractive() {
  const [tasks, setTasks] = useState<Task[]>(INIT);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ start: number; end: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (!dragging) return;
    function move(e: MouseEvent) {
      const d = drag.current;
      if (!d) return;
      const idx = idxFromX(e.clientX, d.rect);
      if (d.mode === "create") {
        setGhost({ start: Math.min(d.anchor, idx), end: Math.max(d.anchor, idx) });
        return;
      }
      setTasks((prev) => prev.map((t) => {
        if (t.id !== d.id) return t;
        if (d.mode === "resize-l") return { ...t, start: Math.min(idx, t.end) };
        if (d.mode === "resize-r") return { ...t, end: Math.max(idx, t.start) };
        // move
        const span = d.origEnd - d.origStart;
        const delta = idx - d.anchor;
        let s = clamp(d.origStart + delta, 0, N - 1 - span);
        return { ...t, start: s, end: s + span };
      }));
    }
    function up() {
      const d = drag.current;
      if (d && d.mode === "create" && ghost) {
        const id = `n${nextId.current++}`;
        setTasks((prev) => [...prev, { id, title: "새 태스크", start: ghost.start, end: ghost.end, status: "todo" }]);
        setEditingId(id);
      }
      setGhost(null);
      setDragging(false);
      drag.current = null;
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [dragging, ghost]);

  function startDrag(e: React.MouseEvent, mode: "move" | "resize-l" | "resize-r", t: Task) {
    e.stopPropagation();
    const area = (e.currentTarget as HTMLElement).closest("[data-track]") as HTMLElement;
    const rect = area.getBoundingClientRect();
    drag.current = { mode, id: t.id, rect, anchor: idxFromX(e.clientX, rect), origStart: t.start, origEnd: t.end };
    setDragging(true);
  }
  function startCreate(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const anchor = idxFromX(e.clientX, rect);
    drag.current = { mode: "create", rect, anchor };
    setGhost({ start: anchor, end: anchor });
    setDragging(true);
  }
  function quickAdd() {
    const title = newTitle.trim();
    if (title) setTasks((prev) => [...prev, { id: `n${nextId.current++}`, title, start: 0, end: 0, status: "todo" }]);
    setNewTitle(""); setAdding(false);
  }
  function commitTitle(id: string, value: string) {
    const v = value.trim();
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title: v || "새 태스크" } : t)));
    setEditingId(null);
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white">
      {/* 월 축 */}
      <div className="flex items-center border-b border-gray-100">
        <div className="flex w-56 shrink-0 items-center px-4 py-3"><span className="text-xs font-medium text-gray-400">태스크</span></div>
        <div className="relative flex flex-1">{MONTHS.map((m) => <div key={m} className="flex-1 border-l border-gray-100 px-2 py-3 text-center text-xs font-medium text-gray-500">{m}</div>)}</div>
      </div>

      {tasks.map((t) => (
        <div key={t.id} className="flex items-center border-b border-gray-50 hover:bg-gray-50/40">
          <div className="w-56 shrink-0 px-4 py-3">
            {editingId === t.id ? (
              <input autoFocus defaultValue={t.title === "새 태스크" ? "" : t.title} placeholder="태스크 제목"
                onBlur={(e) => commitTitle(t.id, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitTitle(t.id, (e.target as HTMLInputElement).value); }}
                className="w-full rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none" />
            ) : (
              <button onClick={() => setEditingId(t.id)} className="truncate text-left text-sm font-medium text-gray-900 hover:text-blue-600">{t.title}</button>
            )}
          </div>
          <div data-track className="relative h-11 flex-1">
            <div className="pointer-events-none absolute inset-0 flex">{MONTHS.map((_, i) => <div key={i} className="flex-1 border-r border-gray-100 last:border-r-0" />)}</div>
            <div
              onMouseDown={(e) => startDrag(e, "move", t)}
              className="group absolute top-1/2 flex h-6 -translate-y-1/2 cursor-grab items-center overflow-hidden rounded-md active:cursor-grabbing"
              style={{ left: `${(t.start / N) * 100}%`, width: `${((t.end - t.start + 1) / N) * 100}%` }}
            >
              <div className={`absolute inset-0 ${barBg[t.status]}`} />
              <div className={`absolute inset-y-0 left-0 ${fill[t.status]} opacity-90`} style={{ width: "100%" }} />
              {/* 리사이즈 핸들 */}
              <span onMouseDown={(e) => startDrag(e, "resize-l", t)} className="relative z-10 h-full w-2 cursor-ew-resize bg-black/0 hover:bg-black/10" />
              <span className="relative z-10 flex-1 truncate px-1 text-[11px] font-medium text-white">{MONTHS[t.start]}~{MONTHS[t.end]}</span>
              <span onMouseDown={(e) => startDrag(e, "resize-r", t)} className="relative z-10 h-full w-2 cursor-ew-resize bg-black/0 hover:bg-black/10" />
            </div>
          </div>
        </div>
      ))}

      {/* 빈 줄 드래그로 생성 + 제목 Enter 추가 */}
      <div className="flex items-center border-b border-gray-50">
        <div className="flex w-56 shrink-0 items-center px-4 py-2.5">
          {adding ? (
            <input autoFocus value={newTitle} placeholder="제목 입력 후 Enter"
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); if (e.key === "Escape") { setNewTitle(""); setAdding(false); } }}
              onBlur={quickAdd}
              className="w-full rounded-lg border border-blue-300 px-2.5 py-1.5 text-sm focus:outline-none" />
          ) : (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-blue-500">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              태스크 추가
            </button>
          )}
        </div>
        <div onMouseDown={startCreate} className="relative h-11 flex-1 cursor-crosshair">
          <div className="pointer-events-none absolute inset-0 flex">{MONTHS.map((_, i) => <div key={i} className="flex-1 border-r border-gray-100 last:border-r-0" />)}</div>
          {ghost && (
            <div className="absolute top-1/2 h-6 -translate-y-1/2 rounded-md border-2 border-dashed border-blue-400 bg-blue-100/50"
              style={{ left: `${(ghost.start / N) * 100}%`, width: `${((ghost.end - ghost.start + 1) / N) * 100}%` }} />
          )}
          {!ghost && <span className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-300">여기를 가로로 드래그하면 그 기간으로 태스크 생성</span>}
        </div>
      </div>

      <div className="bg-amber-50/40 px-4 py-2 text-[11px] text-amber-700">
        ① 왼쪽 “태스크 추가” 제목+Enter · ② 막대 가운데 드래그=이동, 끝 드래그=기간조정 · ③ 아래 빈 줄 가로 드래그=기간부터 생성
      </div>
    </div>
  );
}
