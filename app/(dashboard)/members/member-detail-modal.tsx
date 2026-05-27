"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/avatar";
import { getMemberDetail, deactivateMember } from "./actions";
import { adjustBalance } from "../leaves/actions";
import {
  getEmployeeAttendances,
  updateAttendance,
  createManualAttendance,
  deleteAttendance,
} from "../attendance/actions";

type MemberDetail = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  position: string | null;
  avatarUrl: string | null;
  joinDate: string | null;
  createdAt: string;
  balance: { total: number; used: number } | null;
  recentLeaves: {
    id: string;
    type: string;
    startDate: string;
    endDate: string;
    durationHours: number;
    status: string;
  }[];
};

type AttendanceRecord = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  memo: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  annual: "연차", half_am: "오전 반차", half_pm: "오후 반차", sick: "병가",
  condolence: "경조사", maternity: "출산", paternity: "배우자출산",
  family_care: "가족돌봄", public_duty: "공가", menstrual: "생리",
  compensatory: "대체휴가", other: "기타",
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "대기", className: "bg-yellow-50 text-yellow-700" },
  approved: { label: "승인", className: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "거절", className: "bg-red-50 text-red-500" },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "최고관리자",
  manager: "관리자",
  employee: "직원",
};

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(clockIn: string, clockOut: string) {
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}시간 ${m}분`;
}

export default function MemberDetailModal({
  memberId,
  isManager,
  onClose,
}: {
  memberId: string;
  isManager: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingBalance, setEditingBalance] = useState(false);
  const [editValue, setEditValue] = useState(0);

  // 출퇴근 관리
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [attMonth, setAttMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [attLoading, setAttLoading] = useState(false);
  const [editingAttId, setEditingAttId] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newClockIn, setNewClockIn] = useState("");
  const [newClockOut, setNewClockOut] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const [attError, setAttError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    getMemberDetail(memberId).then((res) => {
      if (res) setData(res);
      setLoading(false);
    });
  }, [memberId]);

  useEffect(() => {
    if (!isManager) return;
    setAttLoading(true);
    getEmployeeAttendances(memberId, attMonth.year, attMonth.month).then((res) => {
      setAttendances(res ?? []);
      setAttLoading(false);
    });
  }, [memberId, attMonth, isManager]);

  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  async function handleDeactivate() {
    if (!data) return;
    await deactivateMember(data.id);
    onClose();
  }

  async function handleSaveBalance() {
    if (!data) return;
    const formData = new FormData();
    formData.set("employeeId", data.id);
    formData.set("total", String(editValue));
    await adjustBalance(formData);
    setEditingBalance(false);
    const res = await getMemberDetail(memberId);
    if (res) setData(res);
  }

  function startEdit(record: AttendanceRecord) {
    setEditingAttId(record.id);
    setEditClockIn(toLocalDatetime(record.clock_in));
    setEditClockOut(record.clock_out ? toLocalDatetime(record.clock_out) : "");
    setEditMemo(record.memo ?? "");
    setAttError(null);
  }

  async function handleSaveAttendance() {
    if (!editingAttId || !editClockIn) return;
    setAttError(null);
    const res = await updateAttendance(
      editingAttId,
      new Date(editClockIn).toISOString(),
      editClockOut ? new Date(editClockOut).toISOString() : null,
      editMemo || undefined,
    );
    if (res && "error" in res) {
      setAttError(res.error ?? "오류가 발생했습니다");
      return;
    }
    setEditingAttId(null);
    // 새로고침
    const fresh = await getEmployeeAttendances(memberId, attMonth.year, attMonth.month);
    setAttendances(fresh ?? []);
  }

  async function handleCreateAttendance() {
    if (!newClockIn) return;
    setAttError(null);
    const res = await createManualAttendance(
      memberId,
      new Date(newClockIn).toISOString(),
      newClockOut ? new Date(newClockOut).toISOString() : null,
      newMemo || undefined,
    );
    if (res && "error" in res) {
      setAttError(res.error ?? "오류가 발생했습니다");
      return;
    }
    setAddingNew(false);
    setNewClockIn("");
    setNewClockOut("");
    setNewMemo("");
    const fresh = await getEmployeeAttendances(memberId, attMonth.year, attMonth.month);
    setAttendances(fresh ?? []);
  }

  async function handleDeleteAttendance(id: string) {
    setAttError(null);
    const res = await deleteAttendance(id);
    if (res && "error" in res) {
      setAttError(res.error ?? "오류가 발생했습니다");
      return;
    }
    setConfirmDeleteId(null);
    const fresh = await getEmployeeAttendances(memberId, attMonth.year, attMonth.month);
    setAttendances(fresh ?? []);
  }

  function navigateMonth(dir: -1 | 1) {
    setAttMonth((prev) => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 1) { m = 12; y--; }
      if (m > 12) { m = 1; y++; }
      return { year: y, month: m };
    });
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-medium text-gray-900">멤버 상세</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : data ? (
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            {/* 프로필 */}
            <div className="mb-5 flex items-center gap-3">
              <Avatar url={data.avatarUrl} name={data.name} size={48} />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-medium text-gray-900">{data.name}</p>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                    {ROLE_LABELS[data.role] ?? data.role}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{data.email}</p>
                {data.position && <p className="text-xs text-gray-400">{data.position}</p>}
              </div>
            </div>

            {/* 기본 정보 */}
            <div className="mb-5 flex flex-col gap-2">
              {data.joinDate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">입사일</span>
                  <span className="text-gray-900">{data.joinDate}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">가입일</span>
                <span className="text-gray-900">{new Date(data.createdAt).toLocaleDateString("ko-KR")}</span>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* 연차 현황 */}
            <div className="my-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">
                  연차 현황 ({new Date().getFullYear()})
                </h3>
                {isManager && !editingBalance && (
                  <button
                    onClick={() => { setEditingBalance(true); setEditValue(data.balance?.total ?? 0); }}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    수정
                  </button>
                )}
              </div>

              {data.balance ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-[11px] text-gray-500">총 연차</p>
                    {editingBalance ? (
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(Number(e.target.value))}
                          min={0}
                          max={50}
                          className="w-14 rounded border border-gray-200 px-1 py-0.5 text-center text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <p className="mt-0.5 text-lg font-semibold text-gray-900">{data.balance.total}<span className="text-xs font-normal text-gray-400">일</span></p>
                    )}
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-[11px] text-gray-500">사용</p>
                    <p className="mt-0.5 text-lg font-semibold text-gray-900">{data.balance.used}<span className="text-xs font-normal text-gray-400">일</span></p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <p className="text-[11px] text-blue-500">잔여</p>
                    <p className="mt-0.5 text-lg font-semibold text-blue-500">{data.balance.total - data.balance.used}<span className="text-xs font-normal text-blue-300">일</span></p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">연차가 아직 부여되지 않았습니다</p>
              )}

              {editingBalance && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleSaveBalance}
                    className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingBalance(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>

            <div className="h-px bg-gray-100" />

            {/* 출퇴근 기록 (관리자만) */}
            {isManager && (
              <>
                <div className="my-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">출퇴근 기록</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigateMonth(-1)} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="min-w-[80px] text-center text-xs text-gray-600">{attMonth.year}년 {attMonth.month}월</span>
                      <button onClick={() => navigateMonth(1)} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {attError && (
                    <p className="mb-2 text-xs text-red-500">{attError}</p>
                  )}

                  {/* 수동 추가 버튼 */}
                  {!addingNew && (
                    <button
                      onClick={() => { setAddingNew(true); setAttError(null); }}
                      className="mb-3 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 py-2 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      근무 기록 추가
                    </button>
                  )}

                  {/* 수동 추가 폼 */}
                  {addingNew && (
                    <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                      <p className="mb-2 text-xs font-medium text-gray-700">근무 기록 추가</p>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <label className="w-12 text-[11px] text-gray-500">출근</label>
                          <input
                            type="datetime-local"
                            value={newClockIn}
                            onChange={(e) => setNewClockIn(e.target.value)}
                            className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-12 text-[11px] text-gray-500">퇴근</label>
                          <input
                            type="datetime-local"
                            value={newClockOut}
                            onChange={(e) => setNewClockOut(e.target.value)}
                            className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-12 text-[11px] text-gray-500">메모</label>
                          <input
                            type="text"
                            value={newMemo}
                            onChange={(e) => setNewMemo(e.target.value)}
                            placeholder="수정 사유"
                            className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCreateAttendance}
                            className="rounded-md bg-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600"
                          >
                            추가
                          </button>
                          <button
                            onClick={() => { setAddingNew(false); setAttError(null); }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {attLoading ? (
                    <div className="flex h-20 items-center justify-center">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    </div>
                  ) : attendances.length === 0 ? (
                    <p className="text-sm text-gray-400">해당 월 출퇴근 기록이 없습니다</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {attendances.map((att) => {
                        const isEditing = editingAttId === att.id;
                        const dateLabel = new Date(att.clock_in).toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });

                        if (isEditing) {
                          return (
                            <div key={att.id} className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <label className="w-12 text-[11px] text-gray-500">출근</label>
                                  <input
                                    type="datetime-local"
                                    value={editClockIn}
                                    onChange={(e) => setEditClockIn(e.target.value)}
                                    className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="w-12 text-[11px] text-gray-500">퇴근</label>
                                  <input
                                    type="datetime-local"
                                    value={editClockOut}
                                    onChange={(e) => setEditClockOut(e.target.value)}
                                    className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="w-12 text-[11px] text-gray-500">메모</label>
                                  <input
                                    type="text"
                                    value={editMemo}
                                    onChange={(e) => setEditMemo(e.target.value)}
                                    placeholder="수정 사유"
                                    className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleSaveAttendance}
                                    className="rounded-md bg-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600"
                                  >
                                    저장
                                  </button>
                                  <button
                                    onClick={() => { setEditingAttId(null); setAttError(null); }}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    취소
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={att.id} className="group flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-gray-700">{dateLabel}</span>
                                {!att.clock_out && (
                                  <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] text-blue-500">근무중</span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px] text-gray-400">
                                {formatTime(att.clock_in)}
                                {att.clock_out && ` ~ ${formatTime(att.clock_out)}`}
                                {att.clock_out && (
                                  <span className="ml-1.5 text-gray-500">
                                    ({formatDuration(att.clock_in, att.clock_out)})
                                  </span>
                                )}
                              </p>
                              {att.memo && (
                                <p className="mt-0.5 text-[10px] text-gray-400">{att.memo}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => startEdit(att)}
                                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                                title="수정"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                              </button>
                              {confirmDeleteId === att.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDeleteAttendance(att.id)}
                                    className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] text-white hover:bg-red-600"
                                  >
                                    삭제
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-[10px] text-gray-400"
                                  >
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(att.id)}
                                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                  title="삭제"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="h-px bg-gray-100" />
              </>
            )}

            {/* 최근 휴가 */}
            <div className="mt-5">
              <h3 className="mb-3 text-sm font-medium text-gray-900">최근 휴가</h3>
              {data.recentLeaves.length === 0 ? (
                <p className="text-sm text-gray-400">휴가 내역이 없습니다</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.recentLeaves.map((leave) => {
                    const st = STATUS_STYLES[leave.status] ?? STATUS_STYLES.pending;
                    return (
                      <div key={leave.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-gray-700">{TYPE_LABELS[leave.type] ?? leave.type}</span>
                            <span className={`rounded px-1 py-0.5 text-[10px] ${st.className}`}>{st.label}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-gray-400">
                            {leave.startDate}{leave.startDate !== leave.endDate && ` ~ ${leave.endDate}`}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">{leave.durationHours}시간</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 퇴사 처리 */}
            {isManager && data.role !== "admin" && (
              <>
                <div className="h-px bg-gray-100" />
                <div className="mt-5">
                  {confirmDeactivate ? (
                    <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                      <p className="text-sm text-red-600">
                        <strong>{data.name}</strong>님을 퇴사 처리하시겠습니까?
                      </p>
                      <p className="mt-1 text-xs text-red-400">비활성화되며 팀에서 제외됩니다.</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={handleDeactivate}
                          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                        >
                          퇴사 처리
                        </button>
                        <button
                          onClick={() => setConfirmDeactivate(false)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeactivate(true)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      퇴사 처리
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-gray-400">멤버 정보를 불러올 수 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
