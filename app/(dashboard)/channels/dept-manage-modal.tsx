"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/avatar";
import { useT } from "@/lib/i18n";
import {
  getCompanyDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  addDepartmentMembers,
  removeDepartmentMember,
} from "./actions";

interface CompanyMember {
  id: string;
  name: string;
  avatar_url: string | null;
  position: string | null;
}

interface ManagedDept {
  id: string;
  name: string;
  color: string;
  description: string | null;
  members: { id: string; name: string; avatar_url: string | null; position: string | null }[];
  channels: { id: string; name: string }[];
}

// TDS 색상 토큰 팔레트
const COLORS = [
  "#3182F6",
  "#1D9E75",
  "#F59E0B",
  "#F04452",
  "#8B5CF6",
  "#EC4899",
  "#0EA5E9",
  "#64748B",
];

export default function DeptManageModal({
  companyMembers,
  onClose,
  onChanged,
}: {
  companyMembers: CompanyMember[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const [depts, setDepts] = useState<ManagedDept[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 신규 부서 폼
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [creating, setCreating] = useState(false);

  // 멤버 토글 진행 중인 user id (스피너 + 중복 클릭 방지)
  const [savingMemberIds, setSavingMemberIds] = useState<Set<string>>(
    new Set()
  );

  // 부서 이름 인라인 편집
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const load = async () => {
    const data = await getCompanyDepartments();
    setDepts(data as ManagedDept[]);
    setLoading(false);
    setSelectedId((prev) => prev ?? (data.length > 0 ? data[0].id : null));
  };

  useEffect(() => {
    getCompanyDepartments().then((data) => {
      setDepts(data as ManagedDept[]);
      setLoading(false);
      setSelectedId((prev) => prev ?? (data.length > 0 ? data[0].id : null));
    });
  }, []);

  const refresh = async () => {
    await load();
    onChanged();
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    const result = await createDepartment(name, newColor);
    setCreating(false);
    if (result.success) {
      setNewName("");
      setNewColor(COLORS[0]);
      await refresh();
      if (result.departmentId) setSelectedId(result.departmentId);
    }
  };

  const handleDelete = async (deptId: string) => {
    if (!confirm(t("channels.deleteConfirm"))) return;
    await deleteDepartment(deptId);
    setSelectedId(null);
    await refresh();
  };

  const handleColorChange = (deptId: string, color: string) => {
    // 낙관적 업데이트 후 백그라운드 저장
    setDepts((prev) =>
      prev.map((d) => (d.id === deptId ? { ...d, color } : d))
    );
    updateDepartment(deptId, { color })
      .then((result) => {
        if (result && "error" in result && result.error) {
          alert(result.error);
          load();
        } else {
          onChanged();
        }
      })
      .catch(() => load());
  };

  const startEditName = (dept: ManagedDept) => {
    setNameDraft(dept.name);
    setEditingName(true);
  };

  const handleRenameDept = (deptId: string) => {
    const name = nameDraft.trim();
    setEditingName(false);
    const current = depts.find((d) => d.id === deptId);
    if (!name || !current || name === current.name) return;

    // 낙관적 업데이트 후 백그라운드 저장
    setDepts((prev) =>
      prev.map((d) => (d.id === deptId ? { ...d, name } : d))
    );
    updateDepartment(deptId, { name })
      .then((result) => {
        if (result && "error" in result && result.error) {
          alert(result.error);
          load();
        } else {
          onChanged();
        }
      })
      .catch(() => load());
  };

  const handleToggleMember = (
    dept: ManagedDept,
    userId: string,
    isMember: boolean
  ) => {
    const member = companyMembers.find((m) => m.id === userId);
    if (!member) return;
    // 같은 멤버에 대한 요청이 진행 중이면 무시 (중복 클릭 방지)
    if (savingMemberIds.has(userId)) return;

    // 낙관적 업데이트: 클릭 즉시 로컬 상태 반영
    setDepts((prev) =>
      prev.map((d) =>
        d.id !== dept.id
          ? d
          : {
              ...d,
              members: isMember
                ? d.members.filter((dm) => dm.id !== userId)
                : [
                    ...d.members,
                    {
                      id: member.id,
                      name: member.name,
                      avatar_url: member.avatar_url,
                      position: member.position,
                    },
                  ],
            }
      )
    );
    setSavingMemberIds((prev) => new Set(prev).add(userId));

    // 서버 동기화는 백그라운드에서 (UI 블로킹 X). 실패 시 롤백 + 안내.
    const action = isMember
      ? removeDepartmentMember(dept.id, userId)
      : addDepartmentMembers(dept.id, [userId]);
    action
      .then(async (result) => {
        if (result && "error" in result && result.error) {
          alert(result.error);
          await load();
        } else {
          onChanged();
        }
      })
      .catch(async () => {
        alert(t("common.errorOccurred"));
        await load();
      })
      .finally(() => {
        setSavingMemberIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      });
  };

  const selectedDept = depts.find((d) => d.id === selectedId);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[600px] w-full max-w-3xl overflow-hidden rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 좌측: 부서 목록 + 생성 */}
        <div className="flex w-64 flex-col border-r border-gray-200 bg-gray-50">
          <div className="flex h-12 items-center border-b border-gray-100 px-4">
            <span className="text-sm font-semibold text-gray-900">
              {t("channels.manageTitle")}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="px-3 py-6 text-center text-xs text-gray-400">
                {t("common.loading")}
              </div>
            ) : (
              depts.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => {
                    setEditingName(false);
                    setSelectedId(dept.id);
                  }}
                  className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    dept.id === selectedId
                      ? "bg-blue-50 font-medium text-blue-500"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: dept.color }}
                  />
                  <span className="truncate">{dept.name}</span>
                  <span className="ml-auto text-[10px] text-gray-400">
                    {dept.members.length}
                  </span>
                </button>
              ))
            )}
          </div>
          {/* 신규 부서 */}
          <div className="border-t border-gray-100 p-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder={t("channels.deptNamePlaceholder")}
              className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none"
            />
            <div className="mb-2 flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`h-5 w-5 rounded-full transition-transform ${
                    newColor === c ? "scale-110 ring-2 ring-gray-300 ring-offset-1" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="w-full rounded-lg bg-blue-500 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400"
            >
              {t("channels.createDept")}
            </button>
          </div>
        </div>

        {/* 우측: 선택 부서 상세 */}
        <div className="flex flex-1 flex-col">
          <div className="flex h-12 items-center justify-between border-b border-gray-100 px-5">
            {selectedDept ? (
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-900">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedDept.color }}
                />
                {editingName ? (
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => handleRenameDept(selectedDept.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameDept(selectedDept.id);
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    className="min-w-0 flex-1 rounded-md border border-blue-300 bg-white px-2 py-0.5 text-sm font-semibold text-gray-900 focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => startEditName(selectedDept)}
                    title={t("channels.editName")}
                    className="group flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-gray-100"
                  >
                    <span className="truncate">{selectedDept.name}</span>
                    <svg
                      className="h-3.5 w-3.5 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                )}
              </span>
            ) : (
              <span className="text-sm text-gray-400">
                {t("channels.selectDept")}
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {selectedDept ? (
            <div className="flex-1 overflow-y-auto p-5">
              {/* 색상 변경 */}
              <div className="mb-5">
                <div className="mb-2 text-xs font-medium text-gray-500">
                  {t("channels.deptColor")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleColorChange(selectedDept.id, c)}
                      className={`h-6 w-6 rounded-full transition-transform ${
                        selectedDept.color === c
                          ? "scale-110 ring-2 ring-gray-300 ring-offset-1"
                          : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* 채널 목록 */}
              <div className="mb-5">
                <div className="mb-2 text-xs font-medium text-gray-500">
                  {t("channels.channelsLabel")} ({selectedDept.channels.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDept.channels.map((c) => (
                    <span
                      key={c.id}
                      className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600"
                    >
                      # {c.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* 멤버 배정 */}
              <div>
                <div className="mb-2 text-xs font-medium text-gray-500">
                  {t("channels.assignMembers")}
                </div>
                <div className="space-y-1">
                  {companyMembers.map((m) => {
                    const isMember = selectedDept.members.some(
                      (dm) => dm.id === m.id
                    );
                    const isSaving = savingMemberIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() =>
                          handleToggleMember(selectedDept, m.id, isMember)
                        }
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-50"
                      >
                        <Avatar url={m.avatar_url} name={m.name} size={28} />
                        <div className="flex-1">
                          <div className="text-sm text-gray-900">{m.name}</div>
                          {m.position && (
                            <div className="text-[11px] text-gray-400">
                              {m.position}
                            </div>
                          )}
                        </div>
                        {isSaving ? (
                          <span className="flex h-5 w-5 items-center justify-center">
                            <svg
                              className="h-4 w-4 animate-spin text-blue-500"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                          </span>
                        ) : (
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                              isMember
                                ? "border-blue-500 bg-blue-500 text-white"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {isMember && (
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M4.5 12.75l6 6 9-13.5"
                                />
                              </svg>
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 삭제 */}
              <div className="mt-6 border-t border-gray-100 pt-4">
                <button
                  onClick={() => handleDelete(selectedDept.id)}
                  className="text-xs font-medium text-red-500 transition-colors hover:text-red-600"
                >
                  {t("channels.deleteDept")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
              {t("channels.selectDept")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
