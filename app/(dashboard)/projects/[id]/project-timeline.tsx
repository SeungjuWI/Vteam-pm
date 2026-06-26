"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { updateTaskStatus, addMilestone, deleteMilestone, updateTaskDates, updateMilestoneDate, reorderTasks, reorderSubtasks, createTaskDraft } from "../actions";
import { useT } from "@/lib/i18n";
import TimelineRangePicker, { type DateRange } from "./range-picker";
import type { Member, Task, MainTask, Milestone } from "./project-types";
import { effectiveProgress as effProgress, taskProgress } from "./project-types";
// 클릭 즉시 떠야 하므로 일반 import (dynamic 지연 로딩이면 첫 클릭 때 청크 컴파일/다운로드로 멈칫함)
import TaskDetailModal from "./task-detail-modal";

// 상태별 막대 색 (차분하게). 진도율(%)만큼 단색으로 채움.
const STATUS_FILL: Record<string, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  pending: "bg-amber-500",
  done: "bg-emerald-500",
};
const STATUS_TRACK: Record<string, string> = {
  todo: "bg-slate-100",
  in_progress: "bg-blue-100",
  pending: "bg-amber-50",
  done: "bg-emerald-100",
};
const STATUS_RING: Record<string, string> = {
  todo: "ring-slate-200",
  in_progress: "ring-blue-200",
  pending: "ring-amber-200",
  done: "ring-emerald-200",
};
// 펜딩(멈춤) 빗금 패턴
const STRIPE = "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,.55) 4px, rgba(255,255,255,.55) 8px)";
const SUB_RING = "ring-slate-200";

// 진도율(%)은 effProgress(= effectiveProgress, project-types)로 통일.
// 타임라인 · 트리 · 상세 모달이 모두 같은 값을 보이게 한 곳에서 계산한다.

// 막대 '색'은 진도(progress)까지 반영한다. status만 보면 진도가 30%인데도 status=todo라
// 회색(slate)으로 차서, 같은 화면의 in_progress(파랑)와 섞여 위화감이 생긴다.
// → 시작 버튼을 안 눌렀어도 progress가 0보다 크면 진행중(파랑)으로 본다. (멈춤=pending은 그대로 호박색)
const colorStatus = (s: { status: string; progress?: number | null }) =>
  s.status === "done" ? "done"
    : s.status === "pending" ? "pending"
    : (s.status === "in_progress" || (s.progress ?? 0) > 0) ? "in_progress"
    : "todo";


function Check({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 text-transparent hover:border-blue-400"}`}>
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
    </button>
  );
}

// 막대 우측 끝에 담당자 프로필을 띄운다(행 hover 시 페이드인). 막대가 화면 오른쪽에 닿거나
// 범위 밖으로 빠져나가면(rightPct가 큼) 우측 '바깥'은 잘리므로, 보이는 막대 끝(최대 98%)
// '안쪽'에 겹쳐 왼쪽으로 펼친다. 그 외엔 막대 오른쪽 바깥에 붙인다.
function HoverAssignees({ assignees, rightPct }: { assignees: Task["assignees"]; rightPct: number }) {
  if (!assignees || assignees.length === 0) return null;
  const flip = rightPct > 86;
  const anchor = Math.min(rightPct, 98);
  return (
    <div
      className={`pointer-events-none absolute top-1/2 z-30 flex -translate-y-1/2 items-center -space-x-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${flip ? "flex-row-reverse space-x-reverse pr-2" : "pl-2"}`}
      style={flip ? { right: `${100 - anchor}%` } : { left: `${rightPct}%` }}
    >
      {assignees.slice(0, 3).map((a, i) => (
        <div key={i} title={a.name} className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500 shadow-sm ring-2 ring-white">
          {a.avatarUrl ? <Image src={a.avatarUrl} alt={a.name} width={24} height={24} className="h-full w-full object-cover" /> : a.name[0]}
        </div>
      ))}
      {assignees.length > 3 && <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[9px] font-semibold text-gray-600 ring-2 ring-white">+{assignees.length - 3}</div>}
    </div>
  );
}

export default function ProjectTimeline({ projectId, mainTasks, members, allMembers, currentUserId, milestones }: {
  projectId: string; mainTasks: MainTask[]; members: Member[]; allMembers: Member[]; currentUserId: string; milestones: Milestone[];
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState<Set<string>>(new Set(mainTasks.filter((m) => m.subtasks.length > 0).map((m) => m.id)));
  const [scale, setScale] = useState<"week" | "month" | "year">("month");
  const scaleKey = `vteam:timeline-scale:${projectId}`;
  useEffect(() => { try { const v = localStorage.getItem(scaleKey); if (v === "week" || v === "year") setScale(v); } catch {} }, [scaleKey]);
  const chooseScale = (v: "week" | "month" | "year") => { setScale(v); try { localStorage.setItem(scaleKey, v); } catch {} };

  // 보이는 날짜 범위(차트 단위와 독립). 기본값=이번 분기(이번 달 ~ +2개월).
  const [range, setRange] = useState<DateRange>(() => {
    const t = new Date();
    const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { start: f(new Date(t.getFullYear(), t.getMonth(), 1)), end: f(new Date(t.getFullYear(), t.getMonth() + 3, 0)) };
  });
  const rangeKey = `vteam:timeline-range:${projectId}`;
  useEffect(() => { try { const v = localStorage.getItem(rangeKey); if (v) { const r = JSON.parse(v); if (r?.start && r?.end) setRange(r); } } catch {} }, [rangeKey]);
  const chooseRange = (r: DateRange) => { setRange(r); try { localStorage.setItem(rangeKey, JSON.stringify(r)); } catch {} };
  const [selected, setSelected] = useState<Task | null>(null);
  // 메인 완료 확인 모달: 미완료 서브가 남아 있을 때만 띄운다
  const [confirmMain, setConfirmMain] = useState<{ row: MainTask; remaining: number } | null>(null);
  // 대시보드 마감현황 등에서 ?task=<id>로 진입하면 해당 태스크 모달 자동 오픈 (최초 1회만 — 닫은 뒤 refresh로 재오픈되는 것 방지)
  const searchParams = useSearchParams();
  const deepLinkOpened = useRef(false);
  useEffect(() => {
    if (deepLinkOpened.current) return;
    const tid = searchParams.get("task");
    if (!tid) return;
    for (const m of mainTasks) {
      if (m.id === tid) { setSelected(m); deepLinkOpened.current = true; return; }
      const sub = m.subtasks.find((s) => s.id === tid);
      if (sub) { setSelected(sub); deepLinkOpened.current = true; return; }
    }
  }, [searchParams, mainTasks]);
  // 태스크 추가 모달: null=닫힘, parentId=null이면 메인 / 값이 있으면 그 메인의 서브
  const [draftId, setDraftId] = useState<string | null>(null);

  // '추가' = 빈 태스크를 즉시 만들고 동일한 상세 편집기를 연다 (생성/편집 UI 통일)
  async function handleAddTask(parentId: string | null) {
    const r = await createTaskDraft(projectId, parentId);
    if ("error" in r) { alert(r.error); return; }
    if (parentId) setOpen((p) => new Set(p).add(parentId));
    setDraftId(r.task.id);
    setSelected(r.task);
  }
  const [showDone, setShowDone] = useState(false);
  const [addingMs, setAddingMs] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msDate, setMsDate] = useState("");
  const [, startTx] = useTransition();

  // 드래그 상태 (막대/마일스톤 기간 조정)
  const [dragOverride, setDragOverride] = useState<{ id: string; startDate: string; dueDate: string } | null>(null);
  const [msOverride, setMsOverride] = useState<{ id: string; date: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverDay, setHoverDay] = useState<number | null>(null); // 마우스 호버 중인 날짜(가이드선)
  const drag = useRef<null | { kind: "task" | "ms"; mode: "move" | "l" | "r"; id: string; rect: DOMRect; anchorDay: number; downX: number; origS: number; origE: number; latest?: { startDate?: string; dueDate?: string; date?: string } }>(null);
  const moved = useRef(false);
  useEffect(() => { setDragOverride(null); setMsOverride(null); }, [mainTasks, milestones]);

  // 메인태스크 행 순서(드래그 정렬)
  const [order, setOrder] = useState(mainTasks);
  useEffect(() => { setOrder(mainTasks); }, [mainTasks]);
  const orderRef = useRef(order);
  orderRef.current = order;
  const rowDrag = useRef<string | null>(null);
  const [rowDragging, setRowDragging] = useState<string | null>(null);
  function onRowDragEnter(targetId: string) {
    const from = rowDrag.current;
    if (!from || from === targetId) return;
    setOrder((prev) => {
      const arr = [...prev];
      const fi = arr.findIndex((x) => x.id === from);
      const ti = arr.findIndex((x) => x.id === targetId);
      if (fi < 0 || ti < 0) return prev;
      const [m] = arr.splice(fi, 1);
      arr.splice(ti, 0, m);
      return arr;
    });
  }
  function onRowDragEnd() {
    rowDrag.current = null;
    setRowDragging(null);
    startTx(async () => { await reorderTasks(projectId, orderRef.current.map((i) => i.id)); router.refresh(); });
  }

  // 서브태스크 행 순서(드래그 정렬) — 같은 부모 안에서만
  const subDrag = useRef<{ parentId: string; id: string } | null>(null);
  const [subDragging, setSubDragging] = useState<string | null>(null);
  function onSubDragEnter(parentId: string, targetId: string) {
    const d = subDrag.current;
    if (!d || d.parentId !== parentId || d.id === targetId) return;
    setOrder((prev) => prev.map((row) => {
      if (row.id !== parentId) return row;
      const arr = [...row.subtasks];
      const fi = arr.findIndex((x) => x.id === d.id);
      const ti = arr.findIndex((x) => x.id === targetId);
      if (fi < 0 || ti < 0) return row;
      const [m] = arr.splice(fi, 1);
      arr.splice(ti, 0, m);
      return { ...row, subtasks: arr };
    }));
  }
  function onSubDragEnd(parentId: string) {
    subDrag.current = null;
    setSubDragging(null);
    const row = orderRef.current.find((r) => r.id === parentId);
    if (!row) return;
    const ids = row.subtasks.map((s) => s.id);
    startTx(async () => { await reorderSubtasks(projectId, parentId, ids); router.refresh(); });
  }

  function toggle(id: string) { setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  const expandableIds = mainTasks.filter((m) => m.subtasks.length > 0).map((m) => m.id);
  const allOpen = expandableIds.length > 0 && expandableIds.every((id) => open.has(id));
  function toggleAll() { setOpen(allOpen ? new Set() : new Set(expandableIds)); }

  // 펼침/접힘 상태를 프로젝트별로 localStorage에 저장·복원 (새로고침해도 유지)
  const storeKey = `vteam:timeline-open:${projectId}`;
  const skipSave = useRef(true);
  useEffect(() => {
    skipSave.current = true;
    try { const raw = localStorage.getItem(storeKey); if (raw) setOpen(new Set(JSON.parse(raw))); } catch {}
  }, [storeKey]);
  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return; }
    try { localStorage.setItem(storeKey, JSON.stringify([...open])); } catch {}
  }, [open, storeKey]);
  function toggleDone(task: Task) {
    const next = task.status === "done" ? "todo" : "done";
    // 낙관적 업데이트: 서버 왕복/refresh 전에 화면(order)을 즉시 바꿔 체크가 바로 반영되게 한다.
    // 이후 router.refresh()로 들어온 새 props가 useEffect([mainTasks])에서 order를 서버 진실로 되돌려 동기화.
    setOrder((prev) => prev.map((row) => {
      if (row.id === task.id) return { ...row, status: next };
      if (row.subtasks.some((s) => s.id === task.id))
        return { ...row, subtasks: row.subtasks.map((s) => (s.id === task.id ? { ...s, status: next } : s)) };
      return row;
    }));
    startTx(async () => { await updateTaskStatus(task.id, next, projectId); router.refresh(); });
  }

  // 모든 서브태스크를 한 번에 next 상태로 (낙관적 반영 후 서버 동기화)
  function applyAllSubs(row: MainTask, next: "done" | "todo") {
    setOrder((prev) => prev.map((r) => (r.id === row.id ? { ...r, subtasks: r.subtasks.map((s) => ({ ...s, status: next })) } : r)));
    startTx(async () => { await Promise.all(row.subtasks.map((s) => updateTaskStatus(s.id, next, projectId))); router.refresh(); });
  }

  // 메인 체크: 서브 없으면 그 자체 토글. 서브 있으면 미완료가 남아 있을 때만 확인 모달 후 일괄 완료.
  function onMainCheck(row: MainTask) {
    if (row.subtasks.length === 0) { toggleDone(row); return; }
    const remaining = row.subtasks.filter((s) => s.status !== "done").length;
    if (remaining > 0) setConfirmMain({ row, remaining });   // 커스텀 확인 모달
    else applyAllSubs(row, "todo");                          // 이미 전부 완료 → 해제
  }

  // ── 시간축 (주/월/연 전환) ──
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // 시작일이 지났는데 아직 시작 전(0%)이거나, 마감일이 지났는데 미완료 → 경고
  const isLate = (status: string, progress: number, startDate: string | null, dueDate: string | null) => {
    const lateStart = status === "todo" && (progress ?? 0) === 0 && !!startDate && Date.parse(startDate) < todayMid;
    const overdue = status !== "done" && !!dueDate && Date.parse(dueDate) < todayMid;
    return lateStart || overdue;
  };

  // 기본 날짜 헬퍼
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const pad = (n: number) => String(n).padStart(2, "0");
  const daysInM = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const dayNum = (str: string) => { const dt = new Date(str); return Math.floor(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) / 86400000); };
  const fromDayNum = (n: number) => { const dt = new Date(n * 86400000); return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`; };

  // 보기별 컬럼 단위: 주=일(日) 칸 / 월=주(週) 칸 / 연=월(月) 칸
  const utc = (day: number) => { const dt = new Date(day * 86400000); return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), dow: dt.getUTCDay() }; };
  const unitStart = (day: number) => {
    const { y, m, dow } = utc(day);
    if (scale === "week") return day;                            // 일 단위
    if (scale === "month") return day - ((dow + 6) % 7);         // 주(월요일 시작) 단위
    return Math.floor(Date.UTC(y, m, 1) / 86400000);            // 월 단위 (연 보기)
  };
  const unitNext = (day: number) => {
    const { y, m } = utc(day);
    if (scale === "week") return day + 1;
    if (scale === "month") return unitStart(day) + 7;
    return Math.floor(Date.UTC(y, m + 1, 1) / 86400000);
  };
  const unitLabel = (day: number) => {
    const { y, m, d } = utc(day);
    if (scale === "week") return d === 1 ? `${m + 1}월` : `${d}일`; // 일: 날짜(월초엔 "7월")
    if (scale === "month") return `${m + 1}/${d}`;                 // 주: 그 주 월요일 날짜
    return m === 0 ? `${y}` : `${m + 1}월`;                        // 월: 1월엔 연도 표기
  };

  // 데이터 날짜 수집 → 축 범위(단위 경계로 스냅).
  // 드래그(dragOverride/msOverride)와 무관하게 mainTasks/milestones/scale 에만 의존하므로
  // useMemo로 묶어 드래그 중 매 프레임 재계산되지 않게 한다.
  const { axisStart, axisEnd, totalDays, leftPad, columns, N, todayDay, dataStart, dataEnd } = useMemo(() => {
    const todayDay = dayNum(todayStr);
    const allDays = [todayDay];
    for (const mt of mainTasks) {
      for (const x of [mt.startDate, mt.dueDate]) if (x) allDays.push(dayNum(x));
      for (const s of mt.subtasks) for (const x of [s.startDate, s.dueDate]) if (x) allDays.push(dayNum(x));
    }
    for (const ms of milestones) if (ms.date) allDays.push(dayNum(ms.date));
    const minAll = Math.min(...allDays), maxAll = Math.max(...allDays);
    const dataStart = fromDayNum(minAll), dataEnd = fromDayNum(maxAll); // '전체' 프리셋용 데이터 전체범위

    // 축 범위 = 사용자가 고른 날짜 범위(range)를 현재 단위(scale) 경계로 스냅. 차트 단위와 독립.
    const axisStart = unitStart(dayNum(range.start));
    const axisEnd = Math.max(unitNext(dayNum(range.end)), axisStart + 1); // 제외(exclusive) 경계
    // 좌/우 여백(gutter): 컬럼은 axisStart~axisEnd까지만 생성하고, 좌측 스페이서 + 남는 우측 폭으로
    // 양끝에 빈 공간을 둔다 → 첫 라벨이 구분선과 겹치지 않고, 끝이 가장자리에 붙어 답답하지 않게.
    const spanDays = axisEnd - axisStart;
    const leftPad = Math.max(1, Math.ceil(spanDays * 0.025));
    const rightPad = Math.max(2, Math.ceil(spanDays * 0.05));
    const totalDays = Math.max(1, spanDays + leftPad + rightPad);
    // 일(日) 보기 라벨 간격: 범위 시작점부터 '균등 step'으로 찍는다(애플 분석탭 방식).
    // 날짜%5 식이 아니라 step 고정이라 월초(N월)와 직전 날짜가 빠짝 붙는 충돌이 없다.
    // step은 보이는 일수에 맞춰 라벨이 ~20개 이하가 되도록 1·2·5·7·10·14·21·28 중 택1.
    let stepWeek = 30;
    if (scale === "week") for (const s of [1, 2, 5, 7, 10, 14, 21, 28]) { if (totalDays / s <= 20) { stepWeek = s; break; } }
    // 컬럼 목록(각 단위의 시작·끝 일수와 라벨). tick=라벨/격자 표시 여부.
    // 일 보기: 라벨은 step 간격으로 '완전 균등'. 각 달의 첫 격자점만 날짜 대신 "N월"(6월·7월…)로 표기.
    //         → 간격은 항상 step 그대로 유지되고, 달마다 정확히 1개의 월 라벨이 붙는다(점프 없음).
    const columns: { start: number; end: number; label: string; tick: boolean }[] = [];
    let idx = 0;
    for (let c = axisStart; c < axisEnd; c = unitNext(c)) {
      let tick: boolean;
      let label = unitLabel(c);
      if (scale !== "week") tick = true;
      else {
        tick = idx % stepWeek === 0;
        const u = utc(c);
        // 그 달에서 처음 등장하는 격자점(직전 격자점이 다른 달)이면 월 이름, 아니면 N일.
        label = u.d <= stepWeek ? `${u.m + 1}월` : `${u.d}일`;
      }
      columns.push({ start: c, end: Math.min(unitNext(c), axisEnd), label, tick });
      idx++;
    }
    return { axisStart, axisEnd, totalDays, leftPad, columns, N: columns.length, todayDay, dataStart, dataEnd };
    // unitStart/unitNext/unitLabel/dayNum 은 scale 에만 의존하는 순수 헬퍼(매 렌더 재생성되지만 동작 동일) → deps 생략
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTasks, milestones, scale, todayStr, range]);

  // 날짜 → 축 위 좌표(%). 좌측 여백(leftPad)만큼 밀어서 컬럼 스페이서와 정렬.
  const dayToPct = (day: number) => ((day - axisStart + leftPad) / totalDays) * 100;
  const pctDay = (day: number, end: boolean) => dayToPct(clamp(day + (end ? 1 : 0), axisStart, axisEnd));
  const todayIdx = columns.findIndex((c) => todayDay >= c.start && todayDay < c.end);
  // 일 보기는 막대가 '칸 왼쪽 경계' 기준이라 라벨/선도 경계(+0)에 맞춰야 시작일과 정렬된다.
  // 월/연 보기는 라벨이 칸 전체를 의미하므로 칸 중앙(+0.5)에 둔다.
  const markOffset = scale === "week" ? 0 : 0.5;
  const todayPct = dayToPct(todayDay + markOffset);

  function span(startDate: string | null, dueDate: string | null) {
    let left: number, right: number, sNum: number, eNum: number;
    if (startDate) {
      sNum = dayNum(startDate);
      eNum = dayNum(dueDate ?? startDate);
      left = pctDay(sNum, false);
      right = pctDay(eNum, true);
    } else {
      // 시작일이 없으면 마감일이 속한 '한 칸'(주/월/연)을 막대로 표시
      const due = dayNum(dueDate ?? todayStr);
      sNum = unitStart(due);
      eNum = unitNext(due) - 1;
      left = pctDay(sNum, false);
      right = pctDay(eNum, true);
    }
    const width = Math.max(right - left, scale === "year" ? 0.8 : 2);
    // 범위 밖으로 삐져나가면 그쪽 모서리를 직선으로 끊는다(라운드 X) → "범위 밖으로 이어짐" 표시
    return { left: `${left}%`, width: `${width}%`, clipL: sNum < axisStart, clipR: eNum > axisEnd - 1 };
  }
  function msPct(date: string) { return dayToPct(dayNum(date) + 0.5); }

  const Columns = () => (
    <div className="pointer-events-none absolute inset-0 flex">
      <div style={{ width: `${(leftPad / totalDays) * 100}%` }} className="shrink-0" />
      {columns.map((c, i) => (
        scale === "week" ? (
          // 일 보기: 라벨 찍히는 격자점(tick)마다 옅은 점선 세로선. 막대가 칸 왼쪽 경계 기준이라 선도 경계(left-0)에 맞춤.
          <div key={i} style={{ width: `${((c.end - c.start) / totalDays) * 100}%` }} className="relative">
            {c.tick && <span className="absolute inset-y-0 left-0 border-l border-dashed border-gray-100" />}
          </div>
        ) : (
        <div key={i} style={{ width: `${((c.end - c.start) / totalDays) * 100}%` }} className={`relative border-r border-gray-100 last:border-r-0 ${i % 2 === 1 ? "bg-gray-50/50" : ""}`}>
          {/* 연 보기(월 칸)에선 칸을 4등분하는 옅은 주(週) 보조선 */}
          {scale === "year" && <>
            <span className="absolute inset-y-0 left-[25%] w-px bg-gray-100/80" />
            <span className="absolute inset-y-0 left-[50%] w-px bg-gray-100/80" />
            <span className="absolute inset-y-0 left-[75%] w-px bg-gray-100/80" />
          </>}
        </div>
        )
      ))}
    </div>
  );

  // 드래그(마일스톤 이동)용 날짜 역산
  const dateAt = (clientX: number, rect: DOMRect) => {
    const frac = clamp((clientX - rect.left) / rect.width, 0, 0.999999);
    // 좌측 여백(leftPad) 보정 후 범위[axisStart, axisEnd-1]로 클램프 → 여백을 끌어도 범위 밖 날짜 안 나옴
    return fromDayNum(clamp(Math.floor(axisStart + frac * totalDays - leftPad), axisStart, axisEnd - 1));
  };
  const minDay = axisStart;
  const maxDay = axisEnd - 1;
  const dsv = (task: { id: string; startDate: string | null }) => (dragOverride?.id === task.id ? dragOverride.startDate : task.startDate);
  const dev = (task: { id: string; dueDate: string | null }) => (dragOverride?.id === task.id ? dragOverride.dueDate : task.dueDate);
  const msDateOf = (ms: Milestone) => (msOverride?.id === ms.id ? msOverride.date : ms.date);

  // hover 툴팁용 날짜 포맷: "6/3 ~ 6/20 (18일)" / 단일일이면 "6/3"
  const fmtD = (s: string) => { const dt = new Date(s); return `${dt.getMonth() + 1}/${dt.getDate()}`; };
  const fmtRange = (start: string | null, due: string | null) => {
    if (!start && !due) return "기간 미설정";
    const s = start ?? due!, e = due ?? start!;
    if (s === e) return fmtD(s);
    const days = Math.abs(dayNum(e) - dayNum(s)) + 1;
    return `${fmtD(s)} ~ ${fmtD(e)} (${days}일)`;
  };
  // 메인(서브 보유) 막대 툴팁: 메인+서브 전체의 시작~마감 합집합 범위
  const rollupDates = (row: MainTask) => {
    let minS: string | null = null, maxD: string | null = null;
    for (const it of [{ s: dsv(row), d: dev(row) }, ...row.subtasks.map((x) => ({ s: dsv(x), d: dev(x) }))]) {
      const s = it.s ?? it.d, d = it.d ?? it.s;
      if (s && (!minS || s < minS)) minS = s;
      if (d && (!maxD || d > maxD)) maxD = d;
    }
    return { s: minS, d: maxD };
  };

  // 메인 막대 = 메인 자체 기간 ∪ 하위 막대들의 범위(합집합). 날짜 없는 하위는 제외.
  const rollupSpan = (row: MainTask) => {
    const spans: { left: string; width: string }[] = [];
    if (dsv(row) || dev(row)) spans.push(span(dsv(row), dev(row)));
    for (const s of row.subtasks) {
      if (dsv(s) || dev(s)) spans.push(span(dsv(s), dev(s)));
    }
    if (spans.length === 0) return span(dsv(row), dev(row));
    let minL = Infinity, maxR = -Infinity;
    for (const sp of spans) {
      const l = parseFloat(sp.left), w = parseFloat(sp.width);
      if (!isNaN(l) && !isNaN(w)) { minL = Math.min(minL, l); maxR = Math.max(maxR, l + w); }
    }
    if (minL === Infinity) return span(dsv(row), dev(row));
    return { left: `${minL}%`, width: `${maxR - minL}%` };
  };

  function startDrag(e: React.MouseEvent, kind: "task" | "ms", mode: "move" | "l" | "r", item: { id: string; startDate?: string | null; dueDate?: string | null }) {
    const trackEl = (e.currentTarget as HTMLElement).closest("[data-track]") as HTMLElement | null;
    if (!trackEl) return;
    e.preventDefault(); e.stopPropagation();
    const rect = trackEl.getBoundingClientRect();
    const anchorDay = dayNum(dateAt(e.clientX, rect));
    if (kind === "ms") {
      drag.current = { kind, mode: "move", id: item.id, rect, anchorDay, downX: e.clientX, origS: 0, origE: 0 };
    } else {
      let sd: number, ed: number;
      if (item.startDate) {
        // 시작·마감이 있으면 그대로
        sd = dayNum(item.startDate);
        ed = dayNum(item.dueDate ?? item.startDate);
      } else if (item.dueDate) {
        // 시작일이 없으면 화면엔 '마감월 전체'로 보임 → 그 폭을 유지(하루로 쪼그라들지 않게)
        const due = new Date(item.dueDate);
        const y = due.getFullYear(), m0 = due.getMonth();
        sd = dayNum(`${y}-${pad(m0 + 1)}-01`);
        ed = dayNum(`${y}-${pad(m0 + 1)}-${pad(daysInM(y, m0))}`);
      } else {
        sd = ed = dayNum(todayStr);
      }
      if (ed < sd) { const tmp = sd; sd = ed; ed = tmp; }
      drag.current = { kind, mode, id: item.id, rect, anchorDay, downX: e.clientX, origS: sd, origE: ed };
    }
    moved.current = false;
    setHoverDay(null);
    setDragging(true);
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      const d = drag.current; if (!d) return;
      // 클릭과 드래그 구분: 4px 이상 움직여야 비로소 드래그로 인정(클릭만으론 막대 안 변함)
      if (!moved.current && Math.abs(e.clientX - d.downX) <= 4) return;
      moved.current = true;
      const cur = dayNum(dateAt(e.clientX, d.rect));
      if (d.kind === "ms") {
        const date = fromDayNum(cur);
        // 같은 날이면 막대 위치가 동일 → 재렌더 스킵 (픽셀당 setState 방지)
        if (d.latest?.date === date) return;
        d.latest = { date }; setMsOverride({ id: d.id, date }); return;
      }
      let s = d.origS, en = d.origE;
      if (d.mode === "move") { const w = d.origE - d.origS; s = clamp(d.origS + (cur - d.anchorDay), minDay, maxDay - w); en = s + w; }
      else if (d.mode === "l") s = clamp(Math.min(cur, d.origE), minDay, d.origE);
      else if (d.mode === "r") en = clamp(Math.max(cur, d.origS), d.origS, maxDay);
      const startDate = fromDayNum(s), dueDate = fromDayNum(en);
      // 시작/마감이 직전과 같으면(같은 날 안에서의 픽셀 이동) 재렌더 스킵
      if (d.latest?.startDate === startDate && d.latest?.dueDate === dueDate) return;
      d.latest = { startDate, dueDate };
      setDragOverride({ id: d.id, startDate, dueDate });
    }
    function onUp() {
      const d = drag.current;
      drag.current = null;
      setDragging(false);
      if (!d || !moved.current || !d.latest) return;
      if (d.kind === "ms" && d.latest.date) {
        const date = d.latest.date;
        startTx(async () => { const r = await updateMilestoneDate(d.id, projectId, date); if ((r as { error?: string })?.error) alert((r as { error?: string }).error); router.refresh(); });
      } else if (d.latest.startDate && d.latest.dueDate) {
        const { startDate, dueDate } = d.latest;
        startTx(async () => { const r = await updateTaskDates(d.id, projectId, startDate, dueDate); if ((r as { error?: string })?.error) alert((r as { error?: string }).error); router.refresh(); });
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, minDay, maxDay, N, projectId, router]);

  async function submitMilestone() {
    if (!msTitle.trim() || !msDate) { setAddingMs(false); return; }
    await addMilestone(projectId, msTitle, msDate);
    setMsTitle(""); setMsDate(""); setAddingMs(false); router.refresh();
  }

  // 트랙 위 마우스 호버 → 커서가 가리키는 '날짜'를 가이드선으로 표시 (드래그 중엔 드래그 가이드 우선)
  const onTrackHover = (e: React.MouseEvent) => {
    if (dragging) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const frac = clamp((e.clientX - rect.left) / rect.width, 0, 0.999999);
    // 좌측 여백 보정 + 범위로 클램프 → 우측 빈 여백을 호버해도 범위 밖(예: 9/2) 날짜가 안 뜸
    setHoverDay(clamp(Math.floor(axisStart + frac * totalDays - leftPad), axisStart, axisEnd - 1)); // 같은 날이면 동일 값 → 리렌더 안 됨
  };
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const fmtHover = (day: number) => { const dt = new Date(day * 86400000); return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()} (${WD[dt.getUTCDay()]})`; };

  // 세로 가이드선 + 날짜 배지 (드래그=파랑, 호버=회색). pct는 트랙 폭 기준 %.
  const guideLine = (pct: number, label: string, key: string, align: "start" | "end" = "start", tone: "blue" | "slate" = "blue") => (
    <div key={key} className={`absolute bottom-0 top-9 z-40 w-px -translate-x-1/2 ${tone === "blue" ? "bg-blue-500" : "bg-slate-400"}`} style={{ left: `${pct}%` }}>
      <span className={`absolute top-0.5 ${align === "end" ? "right-1" : "left-1"} whitespace-nowrap rounded ${tone === "blue" ? "bg-blue-500" : "bg-slate-600"} px-1.5 py-0.5 text-[10px] font-semibold text-white`}>{label}</span>
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white">
      {/* 우측에 날짜 범위 선택 + 보기 단위 전환(일/주/월) 나란히 — 내부 scale 키(week/month/year)는 localStorage 호환 위해 유지 */}
      <div className="flex items-center justify-end px-4 pb-4 pt-3">
        <button onClick={() => handleAddTask(null)} className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>{t("tasks.addMain")}
        </button>
      </div>
      <div className="flex items-center justify-end gap-2 border-b border-gray-100 px-4 py-2">
        <TimelineRangePicker value={range} todayStr={todayStr} dataStart={dataStart} dataEnd={dataEnd} onChange={chooseRange} />
        <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5">
          {([["week", "일"], ["month", "주"], ["year", "월"]] as const).map(([v, ko]) => (
            <button key={v} onClick={() => chooseScale(v)}
              className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${scale === v ? "bg-white text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>{ko}</button>
          ))}
        </div>
      </div>
      {/* 헤더 */}
      <div className="flex items-stretch border-b border-gray-100 bg-gray-50/30">
        <div className="flex w-72 shrink-0 items-end justify-between border-r border-gray-100 px-5 pb-3">
          <span className="text-[13px] font-semibold text-gray-700">{t("tasks.mainTasks")}</span>
          {expandableIds.length > 0 && (
            <button onClick={toggleAll} title={allOpen ? "모두 접기" : "모두 펼치기"} className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-blue-500">
              <svg className={`h-3.5 w-3.5 transition-transform ${allOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              {allOpen ? "접기" : "펼치기"}
            </button>
          )}
        </div>
        <div className="relative flex flex-1 pt-7 pb-3">
          <div style={{ width: `${(leftPad / totalDays) * 100}%` }} className="shrink-0" />
          {columns.map((c, i) => (
            <div key={i} style={{ width: `${((c.end - c.start) / totalDays) * 100}%` }} className="relative">
              {c.tick && <span className={`absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[13px] font-medium ${scale === "week" ? "left-0" : "left-1/2"} ${i === todayIdx ? "text-gray-900" : "text-gray-600"}`}>{c.label}</span>}
            </div>
          ))}
          {todayIdx >= 0 && todayIdx < N && (
            <div className="pointer-events-none absolute top-1.5 z-20 -translate-x-1/2" style={{ left: `${todayPct}%` }}>
              <span className="whitespace-nowrap rounded-full bg-gray-700 px-2.5 py-1 text-xs font-semibold text-white">Today</span>
            </div>
          )}
          {/* 호버 날짜 배지 — 선은 트랙 안에, 날짜 읽기는 헤더 상단에 */}
          {!dragging && hoverDay !== null && (
            <div className="pointer-events-none absolute top-1.5 z-30 -translate-x-1/2" style={{ left: `${dayToPct(hoverDay + markOffset)}%` }}>
              <span className="whitespace-nowrap rounded-full bg-slate-500 px-2 py-0.5 text-[11px] font-semibold text-white">{fmtHover(hoverDay)}</span>
            </div>
          )}
        </div>
      </div>

      {order.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-300">{t("tasks.emptyMain")}</div>
      ) : (() => {
        const isMainDone = (r: MainTask) => (r.subtasks.length > 0 ? r.subtasks.every((s) => s.status === "done") : r.status === "done");
        const renderMainRow = (row: MainTask) => {
        const isOpen = open.has(row.id);
        const subs = row.subtasks;
        const hasSubs = subs.length > 0;
        // 서브가 있으면 메인은 서브 집계로 표시 (진도 평균·상태·경고). 서브 없으면 메인 자체 값.
        const effStatus = hasSubs
          ? (subs.every((s) => s.status === "done") ? "done"
            : subs.some((s) => s.status === "pending") ? "pending"
            : subs.some((s) => s.status === "in_progress" || effProgress(s) > 0) ? "in_progress"
            : "todo")
          : colorStatus(row);
        const isDone = effStatus === "done";
        const pctV = taskProgress(row);
        const barStyle = rollupSpan(row);
        const barLeftPct = parseFloat(barStyle.left);
        const barRightPct = barLeftPct + parseFloat(barStyle.width);
        // 메인 막대 담당자 = 메인 자체 ∪ 모든 서브 담당자(이름 기준 중복 제거).
        // 담당자가 서브에만 붙는 경우가 많아, 메인 자체만 보면 비어 아바타가 안 뜨는 문제를 막는다.
        const rowAssignees = (() => {
          const seen = new Set<string>();
          const out: Task["assignees"] = [];
          for (const a of [...row.assignees, ...row.subtasks.flatMap((s) => s.assignees)]) {
            if (!seen.has(a.name)) { seen.add(a.name); out.push(a); }
          }
          return out;
        })();
        // 메인 막대도 합집합 범위가 차트 범위를 벗어나면 그쪽 모서리를 직선으로 끊는다.
        const rd = rollupDates(row);
        const barClipL = !!rd.s && dayNum(rd.s) < axisStart;
        const barClipR = !!rd.d && dayNum(rd.d) > axisEnd - 1;
        const warn = hasSubs
          ? subs.some((s) => isLate(s.status, s.progress ?? 0, s.startDate, s.dueDate))
          : isLate(row.status, pctV, row.startDate, row.dueDate);
        return (
          <div key={row.id}>
            <div onDragEnter={() => onRowDragEnter(row.id)} onDragOver={(e) => e.preventDefault()} className={`group flex items-center transition-colors hover:bg-gray-50/40 ${rowDragging === row.id ? "opacity-40" : ""}`}>
              <div className="flex w-72 shrink-0 items-center gap-1.5 border-r border-gray-100 px-3 py-3">
                <span draggable onDragStart={() => { rowDrag.current = row.id; setRowDragging(row.id); }} onDragEnd={onRowDragEnd} title="드래그로 순서 변경" className="shrink-0 cursor-grab text-gray-300 opacity-0 transition-all hover:text-gray-500 group-hover:opacity-100 active:cursor-grabbing">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><circle cx="7" cy="5" r="1.4" /><circle cx="7" cy="10" r="1.4" /><circle cx="7" cy="15" r="1.4" /><circle cx="13" cy="5" r="1.4" /><circle cx="13" cy="10" r="1.4" /><circle cx="13" cy="15" r="1.4" /></svg>
                </span>
                <Check done={isDone} onClick={() => onMainCheck(row)} />
                <button onClick={() => toggle(row.id)} className="shrink-0 text-gray-300 hover:text-gray-500" title={t("tasks.addSub")}>
                  <svg className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </button>
                {warn && <span title="시작일이 지났는데 시작 전이거나 마감이 지났어요" className="shrink-0 text-red-500"><svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg></span>}
                <button onClick={() => setSelected(row)} title={row.title} className={`truncate text-left text-[15px] font-semibold hover:text-blue-600 ${isDone ? "text-gray-300 line-through" : warn ? "text-red-700" : "text-gray-900"}`}>{row.title}</button>
              </div>
              <div data-track onMouseMove={onTrackHover} onMouseLeave={() => setHoverDay(null)} className="relative block h-14 flex-1 cursor-default">
                <Columns />
                {todayIdx >= 0 && todayIdx < N && <span className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-gray-300" style={{ left: `${todayPct}%` }} />}
                {!dragging && hoverDay !== null && <span className="pointer-events-none absolute inset-y-0 z-20 w-px -translate-x-1/2 bg-slate-400" style={{ left: `${dayToPct(hoverDay + markOffset)}%` }} />}
                <div title={(() => { const r = rollupDates(row); return `${pctV}% · ${fmtRange(r.s, r.d)}${hasSubs ? "" : " · 끌어서 기간 변경"}`; })()} onMouseDown={hasSubs ? () => { moved.current = false; } : (e) => startDrag(e, "task", "move", row)} onClick={() => { if (moved.current) { moved.current = false; return; } setSelected(row); }} className={`absolute top-1/2 flex h-9 -translate-y-1/2 items-center overflow-hidden rounded-lg ${barClipL ? "rounded-l-none" : ""} ${barClipR ? "rounded-r-none" : ""} ${STATUS_TRACK[effStatus]} ring-inset group-hover:ring-2 ${warn ? "ring-2 ring-red-400" : `ring-1 ${STATUS_RING[effStatus]}`} ${hasSubs ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`} style={barStyle}>
                  {/* 진도 채움 — 채워진 구간 '안'에 흰색 %를 두어, 채운 만큼만 흰색으로 잘려 보인다 */}
                  <div className={`absolute inset-y-0 left-0 z-10 overflow-hidden rounded-lg ${STATUS_FILL[effStatus]} transition-[width] duration-300`} style={{ width: `${pctV}%` }}>
                    {effStatus === "pending" && <div className="absolute inset-0" style={{ backgroundImage: STRIPE }} />}
                    <span className="pointer-events-none absolute left-0 top-1/2 ml-2.5 -translate-y-1/2 whitespace-nowrap text-[13px] font-semibold text-white">{pctV}%<span className="ml-2">{row.title}</span></span>
                  </div>
                  {/* 빈 구간용 어두운 %·이름 — 채움(z-10) 아래에 깔려, 안 채워진 부분에서만 드러난다. 막대 폭에서 잘림 */}
                  <span className="pointer-events-none absolute left-0 top-1/2 z-0 ml-2.5 -translate-y-1/2 whitespace-nowrap text-[13px] font-semibold text-gray-800">{pctV}%<span className="ml-2">{row.title}</span></span>
                  {!hasSubs && <>
                    <span onMouseDown={(e) => { e.stopPropagation(); startDrag(e, "task", "l", row); }} className="absolute inset-y-0 left-0 z-30 w-2 cursor-ew-resize" />
                    <span onMouseDown={(e) => { e.stopPropagation(); startDrag(e, "task", "r", row); }} className="absolute inset-y-0 right-0 z-30 w-2 cursor-ew-resize" />
                  </>}
                </div>
                <HoverAssignees assignees={rowAssignees} rightPct={barRightPct} />
              </div>
            </div>

            {isOpen && (
              <div>
                {row.subtasks.map((sub, si) => {
                  const sDone = sub.status === "done";
                  const subPct = effProgress(sub);
                  const subWarn = isLate(sub.status, subPct, sub.startDate, sub.dueDate);
                  const subBar = span(dsv(sub), dev(sub));
                  const subLeftPct = parseFloat(subBar.left);
                  const subRightPct = subLeftPct + parseFloat(subBar.width);
                  const subColor = colorStatus(sub);
                  const isLastSub = si === row.subtasks.length - 1;
                  return (
                    <div key={sub.id} onDragEnter={() => onSubDragEnter(row.id, sub.id)} onDragOver={(e) => e.preventDefault()} className={`group flex items-center hover:bg-gray-50/40 ${subDragging === sub.id ? "opacity-40" : ""}`}>
                      <div className="relative flex w-72 shrink-0 items-center gap-1.5 border-r border-gray-100 py-3 pr-4 pl-[78px]">
                        {/* 트리 연결선: 메인의 펼침 화살표(▸) 바로 아래에서 수직선이 내려와 각 서브 체크박스로 ㄴ자로 분기 → 메인/서브 위계를 또렷이 */}
                        <span aria-hidden className={`pointer-events-none absolute left-[66px] w-px bg-gray-200 ${isLastSub ? "top-0 h-1/2" : "inset-y-0"}`} />
                        <span aria-hidden className="pointer-events-none absolute left-[66px] top-1/2 h-px w-3 -translate-y-px bg-gray-200" />
                        <span draggable onDragStart={() => { subDrag.current = { parentId: row.id, id: sub.id }; setSubDragging(sub.id); }} onDragEnd={() => onSubDragEnd(row.id)} title="드래그로 순서 변경" className="absolute left-2 top-1/2 z-10 -translate-y-1/2 cursor-grab text-gray-300 opacity-0 transition-all hover:text-gray-500 group-hover:opacity-100 active:cursor-grabbing">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><circle cx="7" cy="5" r="1.4" /><circle cx="7" cy="10" r="1.4" /><circle cx="7" cy="15" r="1.4" /><circle cx="13" cy="5" r="1.4" /><circle cx="13" cy="10" r="1.4" /><circle cx="13" cy="15" r="1.4" /></svg>
                        </span>
                        <Check done={sDone} onClick={() => toggleDone(sub)} />
                        {subWarn && <span title="시작일이 지났는데 시작 전이거나 마감이 지났어요" className="shrink-0 text-red-500"><svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg></span>}
                        <button onClick={() => setSelected(sub)} title={sub.title} className={`truncate text-left text-sm font-medium hover:text-blue-600 ${sDone ? "text-gray-400 line-through" : subWarn ? "text-red-700" : "text-gray-700"}`}>{sub.title}</button>
                      </div>
                      <div data-track onMouseMove={onTrackHover} onMouseLeave={() => setHoverDay(null)} className="relative block h-11 flex-1 cursor-default">
                        <Columns />
                        {todayIdx >= 0 && todayIdx < N && <span className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-gray-300" style={{ left: `${todayPct}%` }} />}
                        {!dragging && hoverDay !== null && <span className="pointer-events-none absolute inset-y-0 z-20 w-px -translate-x-1/2 bg-slate-400" style={{ left: `${dayToPct(hoverDay + markOffset)}%` }} />}
                        <div title={`${subPct}% · ${fmtRange(dsv(sub), dev(sub))} · 끌어서 기간 변경`} onMouseDown={(e) => startDrag(e, "task", "move", sub)} onClick={() => { if (moved.current) { moved.current = false; return; } setSelected(sub); }} className={`absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-md ${subBar.clipL ? "rounded-l-none" : ""} ${subBar.clipR ? "rounded-r-none" : ""} ${STATUS_TRACK[subColor]} ring-inset group-hover:ring-2 ${subWarn ? "ring-2 ring-red-400" : `ring-1 ${STATUS_RING[subColor]}`} cursor-grab active:cursor-grabbing`} style={{ left: subBar.left, width: subBar.width }}>
                          {/* 진도 채움 — 채운 만큼만 흰 이름이 잘려 보인다 */}
                          <div className={`absolute inset-y-0 left-0 z-10 overflow-hidden rounded-md ${STATUS_FILL[subColor]} transition-[width] duration-300`} style={{ width: `${subPct}%` }}>
                            {subColor === "pending" && <div className="absolute inset-0" style={{ backgroundImage: STRIPE }} />}
                            <span className="pointer-events-none absolute left-0 top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap text-[12px] font-semibold text-white">{sub.title}</span>
                          </div>
                          {/* 빈 구간용 어두운 이름 — 채움 아래에 깔려, 안 채워진 부분에서만 드러난다. 막대 폭에서 잘림 */}
                          <span className="pointer-events-none absolute left-0 top-1/2 z-0 ml-2 -translate-y-1/2 whitespace-nowrap text-[12px] font-semibold text-gray-800">{sub.title}</span>
                          <span onMouseDown={(e) => { e.stopPropagation(); startDrag(e, "task", "l", sub); }} className="absolute inset-y-0 left-0 z-30 w-1.5 cursor-ew-resize" />
                          <span onMouseDown={(e) => { e.stopPropagation(); startDrag(e, "task", "r", sub); }} className="absolute inset-y-0 right-0 z-30 w-1.5 cursor-ew-resize" />
                        </div>
                        <HoverAssignees assignees={sub.assignees} rightPct={subRightPct} />
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => handleAddTask(row.id)} className="flex items-center gap-1.5 py-2 pl-[78px] text-xs text-gray-300 hover:text-blue-500">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>{t("tasks.addSub")}
                </button>
              </div>
            )}
          </div>
        );
        };
        const active = order.filter((r) => !isMainDone(r));
        const doneRows = order.filter((r) => isMainDone(r));
        return (
          <>
            {active.map(renderMainRow)}
            {doneRows.length > 0 && (
              <div className="border-t border-gray-100">
                <button onClick={() => setShowDone((v) => !v)} className="flex w-full items-center gap-1.5 px-5 py-2.5 text-xs font-medium text-gray-400 transition-colors hover:text-gray-600">
                  <svg className={`h-3.5 w-3.5 transition-transform ${showDone ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" /></svg>
                  {t("tasks.done")} {doneRows.length}
                </button>
                {showDone && doneRows.map(renderMainRow)}
              </div>
            )}
          </>
        );
      })()}

      {/* 마일스톤 */}
      <div className="flex items-center border-t border-gray-100 bg-amber-50/30">
        <div className="flex w-72 shrink-0 items-center gap-1.5 border-r border-gray-100 px-5 py-3">
          <svg className="h-3 w-3 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l9 9-9 9-9-9z" /></svg>
          <span className="text-[13px] font-semibold text-amber-700">마일스톤</span>
          <button onClick={() => setAddingMs((v) => !v)} className="ml-1 text-amber-500 hover:text-amber-700"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>
        </div>
        <div data-track onMouseMove={onTrackHover} onMouseLeave={() => setHoverDay(null)} className="relative h-11 flex-1">
          <Columns />
          {milestones.map((ms) => {
            const d = msDateOf(ms);
            const lp = msPct(d);
            const dt = new Date(d);
            const onRight = lp > 72;
            return (
            <div key={ms.id} onMouseDown={(e) => startDrag(e, "ms", "move", ms)}
              className={`group absolute top-1/2 z-10 flex -translate-y-1/2 cursor-grab items-center gap-1 active:cursor-grabbing ${onRight ? "-translate-x-full flex-row-reverse" : ""}`}
              style={{ left: `${lp}%` }}>
              {/* 다이아몬드 = 정확한 날짜 지점 */}
              <svg className={`h-3 w-3 shrink-0 text-amber-500 ${onRight ? "translate-x-1/2" : "-translate-x-1/2"}`} viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l9 9-9 9-9-9z" /></svg>
              <span className="whitespace-nowrap rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-white">{ms.title} · {dt.getMonth() + 1}/{dt.getDate()}</span>
              <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); startTx(async () => { await deleteMilestone(ms.id, projectId); router.refresh(); }); }} className="hidden text-amber-400 hover:text-amber-600 group-hover:block"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            );
          })}
        </div>
      </div>
      {addingMs && (
        <div className="flex items-center gap-2 border-t border-gray-100 bg-amber-50/20 px-5 py-2.5">
          <input value={msTitle} onChange={(e) => setMsTitle(e.target.value)} placeholder="마일스톤 이름" className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
          <input type="date" value={msDate} onChange={(e) => setMsDate(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none" />
          <button onClick={submitMilestone} className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500">추가</button>
        </div>
      )}

      {/* 드래그 중 날짜 가이드선만 전체 정렬 오버레이로 표시 (호버 선은 각 트랙 안에서 그림) */}
      {dragging && (dragOverride || msOverride) && (
        <div className="pointer-events-none absolute inset-0 z-40 flex">
          <div className="w-72 shrink-0" />
          <div className="relative flex-1">
            {dragOverride && guideLine(pctDay(dayNum(dragOverride.startDate), false), fmtD(dragOverride.startDate), "g-s", "start", "blue")}
            {dragOverride && guideLine(pctDay(dayNum(dragOverride.dueDate), true), fmtD(dragOverride.dueDate), "g-e", "end", "blue")}
            {msOverride && guideLine(msPct(msOverride.date), fmtD(msOverride.date), "g-m", "start", "blue")}
          </div>
        </div>
      )}

      {selected && (
        <TaskDetailModal task={selected} projectId={projectId} allMembers={allMembers} projectMembers={members} currentUserId={currentUserId} isDraft={selected.id === draftId} subtasks={order.find((m) => m.id === selected.id)?.subtasks ?? []} onClose={() => { setSelected(null); setDraftId(null); }} />
      )}

      {/* 메인 완료 확인 모달 (미완료 서브가 남아 있을 때) */}
      {confirmMain && (
        <div onClick={() => setConfirmMain(null)} className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-amber-50">
              <svg className="h-6 w-6 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            </div>
            <h3 className="text-base font-bold text-gray-900">{t("tasks.completeMainTitle")}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
              {t("tasks.completeMainConfirm").replace("{n}", String(confirmMain.remaining)).replace("{total}", String(confirmMain.row.subtasks.length))}
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmMain(null)} className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200">{t("common.cancel")}</button>
              <button onClick={() => { applyAllSubs(confirmMain.row, "done"); setConfirmMain(null); }} className="flex-1 rounded-xl bg-blue-500 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-600">{t("tasks.completeMainAction")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
