"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/avatar";
import { getMemberDetail, deactivateMember } from "./actions";
import { adjustBalance } from "../leaves/actions";

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

  useEffect(() => {
    getMemberDetail(memberId).then((res) => {
      if (res) setData(res);
      setLoading(false);
    });
  }, [memberId]);

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
    // 새로고침
    const res = await getMemberDetail(memberId);
    if (res) setData(res);
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
