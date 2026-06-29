"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/avatar";
import { getMemberDetail, deactivateMember, changeMemberRole } from "./actions";
import { getIpPolicies, assignIpPolicy } from "../ip-policies/actions";
import { adjustBalance } from "../../leaves/actions";
import {
  getEmployeeAttendances,
  updateAttendance,
  createManualAttendance,
  deleteAttendance,
} from "../../attendance/actions";
import { useT } from "@/lib/i18n";
import { Select } from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/date-picker";

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
  ipPolicyId: string | null;
  isOwner: boolean;
  isSelf: boolean;
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

const TYPE_KEYS: Record<string, string> = {
  annual: "leaveType.annual", half_am: "leaveType.half_am", half_pm: "leaveType.half_pm", sick: "leaveType.sick",
  condolence: "leaveType.condolence", maternity: "leaveType.maternity", paternity: "leaveType.paternity",
  family_care: "leaveType.family_care", public_duty: "leaveType.public_duty", menstrual: "leaveType.menstrual",
  compensatory: "leaveType.compensatory", other: "leaveType.other",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-500",
};
const STATUS_KEYS: Record<string, string> = {
  pending: "leaveStatus.pending",
  approved: "leaveStatus.approved",
  rejected: "leaveStatus.rejected",
};

const ROLE_KEYS: Record<string, string> = {
  admin: "role.admin",
  employee: "role.employee",
};

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(clockIn: string, clockOut: string, tHours: string, tMinutes: string) {
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}${tHours} ${m}${tMinutes}`;
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
  const t = useT();
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingBalance, setEditingBalance] = useState(false);
  const [editValue, setEditValue] = useState(0);

  // 출퇴근 IP 제한
  const [ipPolicies, setIpPolicies] = useState<{ id: string; name: string; cidrs: string[] }[]>([]);
  const [savingIpPolicy, setSavingIpPolicy] = useState(false);

  // 권한 변경
  const [confirmRole, setConfirmRole] = useState<"admin" | "employee" | null>(null);
  const [changingRole, setChangingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isManager) return;
    getIpPolicies().then(setIpPolicies);
  }, [isManager]);

  async function handleAssignIpPolicy(policyId: string | null) {
    if (!data) return;
    const prev = data.ipPolicyId;
    setSavingIpPolicy(true);
    setData({ ...data, ipPolicyId: policyId }); // 낙관적 업데이트
    const res = await assignIpPolicy(data.id, policyId);
    if (res && "error" in res) {
      setData((d) => (d ? { ...d, ipPolicyId: prev } : d)); // 실패 시 롤백
    }
    setSavingIpPolicy(false);
  }

  async function handleChangeRole(newRole: "admin" | "employee") {
    if (!data) return;
    setChangingRole(true);
    setRoleError(null);
    const res = await changeMemberRole(data.id, newRole);
    if (res && "error" in res) {
      setRoleError(res.error ?? t("common.errorOccurred"));
    } else {
      setData({ ...data, role: newRole });
    }
    setChangingRole(false);
    setConfirmRole(null);
  }

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
      setAttError(res.error ?? t("common.errorOccurred"));
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
      setAttError(res.error ?? t("common.errorOccurred"));
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
      setAttError(res.error ?? t("common.errorOccurred"));
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
          <h2 className="text-sm font-medium text-gray-900">{t("members.detail")}</h2>
          <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600 active:scale-[0.95]">
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
                    {ROLE_KEYS[data.role] ? t(ROLE_KEYS[data.role] as any) : data.role}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{data.email}</p>
                {data.position && <p className="text-xs text-gray-600">{data.position}</p>}
              </div>
            </div>

            {/* 기본 정보 */}
            <div className="mb-5 flex flex-col gap-2">
              {data.joinDate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t("memberDetail.joinDate")}</span>
                  <span className="text-gray-900">{data.joinDate}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{t("memberDetail.signupDate")}</span>
                <span className="text-gray-900">{new Date(data.createdAt).toLocaleDateString("ko-KR")}</span>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* 연차 현황 */}
            <div className="my-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">
                  {t("memberDetail.leaveBalance")} ({new Date().getFullYear()})
                </h3>
                {isManager && !editingBalance && (
                  <button
                    onClick={() => { setEditingBalance(true); setEditValue(data.balance?.total ?? 0); }}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    {t("common.edit")}
                  </button>
                )}
              </div>

              {data.balance ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-[11px] text-gray-500">{t("leaves.totalAnnual")}</p>
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
                      <p className="mt-0.5 text-lg font-semibold text-gray-900">{data.balance.total}<span className="text-xs font-normal text-gray-600">{t("common.days")}</span></p>
                    )}
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-[11px] text-gray-500">{t("leaves.used")}</p>
                    <p className="mt-0.5 text-lg font-semibold text-gray-900">{data.balance.used}<span className="text-xs font-normal text-gray-600">{t("common.days")}</span></p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <p className="text-[11px] text-blue-500">{t("leaves.remaining")}</p>
                    <p className="mt-0.5 text-lg font-semibold text-blue-500">{data.balance.total - data.balance.used}<span className="text-xs font-normal text-blue-300">{t("common.days")}</span></p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">{t("leaveSettings.balanceNotGranted")}</p>
              )}

              {editingBalance && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleSaveBalance}
                    className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98]"
                  >
                    {t("common.save")}
                  </button>
                  <button
                    onClick={() => setEditingBalance(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {t("common.cancel")}
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
                    <h3 className="text-sm font-medium text-gray-900">{t("attendance.record")}</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigateMonth(-1)} className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-[0.95]">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="min-w-[80px] text-center text-xs text-gray-600">{attMonth.year}년 {attMonth.month}월</span>
                      <button onClick={() => navigateMonth(1)} className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-[0.95]">
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
                      {t("attendance.addRecord")}
                    </button>
                  )}

                  {/* 수동 추가 폼 */}
                  {addingNew && (
                    <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                      <p className="mb-2 text-xs font-medium text-gray-700">{t("attendance.addRecord")}</p>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <label className="w-12 text-[11px] text-gray-500">{t("attendance.clockIn")}</label>
                          <DateTimePicker
                            value={newClockIn}
                            onChange={(v) => setNewClockIn(v)}
                            className="flex-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-12 text-[11px] text-gray-500">{t("attendance.clockOut")}</label>
                          <DateTimePicker
                            value={newClockOut}
                            onChange={(v) => setNewClockOut(v)}
                            className="flex-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-12 text-[11px] text-gray-500">{t("attendance.memo")}</label>
                          <input
                            type="text"
                            value={newMemo}
                            onChange={(e) => setNewMemo(e.target.value)}
                            placeholder={t("attendance.memoPlaceholder")}
                            className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCreateAttendance}
                            className="rounded-md bg-blue-500 px-3 py-1 text-xs font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98]"
                          >
                            {t("common.add")}
                          </button>
                          <button
                            onClick={() => { setAddingNew(false); setAttError(null); }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            {t("common.cancel")}
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
                    <p className="text-sm text-gray-600">{t("attendance.noRecord")}</p>
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
                                  <label className="w-12 text-[11px] text-gray-500">{t("attendance.clockIn")}</label>
                                  <DateTimePicker
                                    value={editClockIn}
                                    onChange={(v) => setEditClockIn(v)}
                                    className="flex-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="w-12 text-[11px] text-gray-500">{t("attendance.clockOut")}</label>
                                  <DateTimePicker
                                    value={editClockOut}
                                    onChange={(v) => setEditClockOut(v)}
                                    className="flex-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="w-12 text-[11px] text-gray-500">{t("attendance.memo")}</label>
                                  <input
                                    type="text"
                                    value={editMemo}
                                    onChange={(e) => setEditMemo(e.target.value)}
                                    placeholder={t("attendance.memoPlaceholder")}
                                    className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleSaveAttendance}
                                    className="rounded-md bg-blue-500 px-3 py-1 text-xs font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98]"
                                  >
                                    {t("common.save")}
                                  </button>
                                  <button
                                    onClick={() => { setEditingAttId(null); setAttError(null); }}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    {t("common.cancel")}
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
                                  <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] text-blue-500">{t("attendance.working")}</span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px] text-gray-600">
                                {formatTime(att.clock_in)}
                                {att.clock_out && ` ~ ${formatTime(att.clock_out)}`}
                                {att.clock_out && (
                                  <span className="ml-1.5 text-gray-500">
                                    ({formatDuration(att.clock_in, att.clock_out, t("common.hours"), t("common.minutes"))})
                                  </span>
                                )}
                              </p>
                              {att.memo && (
                                <p className="mt-0.5 text-[10px] text-gray-600">{att.memo}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => startEdit(att)}
                                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 active:scale-[0.95]"
                                title={t("common.edit")}
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
                                    {t("common.delete")}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-[10px] text-gray-400"
                                  >
                                    {t("common.cancel")}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(att.id)}
                                  className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 active:scale-[0.95]"
                                  title={t("common.delete")}
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

            {/* 권한 변경 (관리자만, 본인 제외) */}
            {isManager && !data.isSelf && (
              <>
                <div className="my-5">
                  <h3 className="mb-1 text-sm font-medium text-gray-900">{t("memberDetail.permission")}</h3>
                  <p className="mb-3 text-xs text-gray-600">
                    {data.role === "admin" ? t("memberDetail.adminDesc") : t("memberDetail.employeeDesc")}
                  </p>
                  {roleError && <p className="mb-2 text-xs text-red-500">{roleError}</p>}

                  {data.isOwner ? (
                    <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-600">{t("memberDetail.owner")}</span>
                      <span className="text-xs text-gray-500">{t("memberDetail.ownerHint")}</span>
                    </div>
                  ) : confirmRole ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs text-gray-700">
                        {confirmRole === "admin" ? t("memberDetail.promoteConfirm") : t("memberDetail.demoteConfirm")}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleChangeRole(confirmRole)}
                          disabled={changingRole}
                          className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98] disabled:opacity-50"
                        >
                          {confirmRole === "admin" ? t("memberDetail.promote") : t("memberDetail.demote")}
                        </button>
                        <button
                          onClick={() => { setConfirmRole(null); setRoleError(null); }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : data.role === "employee" ? (
                    <button
                      onClick={() => { setConfirmRole("admin"); setRoleError(null); }}
                      className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98]"
                    >
                      {t("memberDetail.promote")}
                    </button>
                  ) : (
                    <button
                      onClick={() => { setConfirmRole("employee"); setRoleError(null); }}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {t("memberDetail.demote")}
                    </button>
                  )}
                </div>

                <div className="h-px bg-gray-100" />
              </>
            )}

            {/* 출퇴근 IP 제한 (관리자만) */}
            {isManager && (
              <>
                <div className="my-5">
                  <h3 className="mb-1 text-sm font-medium text-gray-900">{t("ipPolicy.memberSectionTitle")}</h3>
                  <p className="mb-3 text-xs text-gray-600">{t("ipPolicy.memberSectionDesc")}</p>
                  <Select
                    value={data.ipPolicyId ?? ""}
                    onChange={(v) => handleAssignIpPolicy(v || null)}
                    disabled={savingIpPolicy}
                    options={[
                      { value: "", label: t("ipPolicy.noRestriction") },
                      ...ipPolicies.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                    className="w-full"
                  />
                  {ipPolicies.length === 0 && (
                    <p className="mt-1.5 text-[11px] text-gray-600">{t("ipPolicy.noPolicyHint")}</p>
                  )}
                </div>

                <div className="h-px bg-gray-100" />
              </>
            )}

            {/* 최근 휴가 */}
            <div className="mt-5">
              <h3 className="mb-3 text-sm font-medium text-gray-900">{t("memberDetail.recentLeaves")}</h3>
              {data.recentLeaves.length === 0 ? (
                <p className="text-sm text-gray-600">{t("memberDetail.noLeaves")}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.recentLeaves.map((leave) => {
                    const stClass = STATUS_CLASS[leave.status] ?? STATUS_CLASS.pending;
                    const stKey = STATUS_KEYS[leave.status] ?? STATUS_KEYS.pending;
                    return (
                      <div key={leave.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-gray-700">{TYPE_KEYS[leave.type] ? t(TYPE_KEYS[leave.type] as any) : leave.type}</span>
                            <span className={`rounded px-1 py-0.5 text-[10px] ${stClass}`}>{t(stKey as any)}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-gray-600">
                            {leave.startDate}{leave.startDate !== leave.endDate && ` ~ ${leave.endDate}`}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">{leave.durationHours}{t("common.hours")}</span>
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
                        <strong>{data.name}</strong>{t("memberDetail.deactivateConfirm")}
                      </p>
                      <p className="mt-1 text-xs text-red-400">{t("memberDetail.deactivateDesc")}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={handleDeactivate}
                          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                        >
                          {t("memberDetail.deactivate")}
                        </button>
                        <button
                          onClick={() => setConfirmDeactivate(false)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeactivate(true)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      {t("memberDetail.deactivate")}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-gray-600">{t("members.noDetail")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
