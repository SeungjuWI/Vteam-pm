"use client";

import { useRef, useState } from "react";
import { createProject } from "./actions";
import { compressImage } from "@/lib/compress-image";

interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface Props {
  members: Member[];
  onClose: () => void;
}

export default function CreateProjectModal({ members, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredMembers = members.filter(
    (m) =>
      !selectedMembers.includes(m.id) &&
      (m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  function addMember(id: string) {
    setSelectedMembers((prev) => [...prev, id]);
    setMemberSearch("");
    setShowDropdown(false);
    searchRef.current?.focus();
  }

  function removeMember(id: string) {
    setSelectedMembers((prev) => prev.filter((mid) => mid !== id));
  }

  const compressedRef = useRef<File | null>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { blob, dataUrl } = await compressImage(file, 1200);
      compressedRef.current = new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: blob.type });
      setPreview(dataUrl);
    } catch {
      setError("이미지를 불러올 수 없습니다");
    }
  }

  function removeImage() {
    setPreview(null);
    compressedRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    formData.set("memberIds", selectedMembers.join(","));
    if (compressedRef.current) {
      formData.set("image", compressedRef.current);
    }
    const result = await createProject(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">새 프로젝트</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
          {/* 프로젝트 이미지 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">프로젝트 이미지</label>
            {preview ? (
              <div className="relative inline-block">
                <img src={preview} alt="미리보기" className="h-20 w-20 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-gray-300 text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              name="image"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <p className="mt-1 text-[11px] text-gray-400">2MB 이하, 분류용 대표 이미지</p>
          </div>

          {/* 프로젝트 이름 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">프로젝트 이름 <span className="text-red-400">*</span></label>
            <input
              type="text"
              name="name"
              placeholder="예: 신규 서비스 런칭"
              required
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* 프로젝트 설명 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">설명</label>
            <textarea
              name="description"
              placeholder="프로젝트에 대해 간단히 설명해주세요"
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* 담당자 (복수 선택) */}
          <div className="relative">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">담당자</label>

            {/* 선택된 멤버 칩 */}
            {selectedMembers.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedMembers.map((mid) => {
                  const m = members.find((member) => member.id === mid);
                  if (!m) return null;
                  return (
                    <span
                      key={mid}
                      className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pr-2 pl-1.5"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-medium text-blue-600">
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                        ) : (
                          m.name[0]
                        )}
                      </span>
                      <span className="text-xs font-medium text-blue-700">{m.name}</span>
                      <button
                        type="button"
                        onClick={() => removeMember(mid)}
                        className="text-blue-400 hover:text-blue-600"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* 검색 입력 */}
            <input
              ref={searchRef}
              type="text"
              value={memberSearch}
              onChange={(e) => { setMemberSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder={selectedMembers.length > 0 ? "추가 검색..." : "이름 또는 이메일로 검색"}
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />

            {showDropdown && (
              <>
                <div className="fixed inset-0 z-[5]" onClick={() => setShowDropdown(false)} />
                <div className="absolute top-full left-0 z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1">
                  {filteredMembers.length === 0 ? (
                    <p className="px-3.5 py-2 text-sm text-gray-400">
                      {members.length === selectedMembers.length ? "모든 멤버가 선택됨" : "검색 결과 없음"}
                    </p>
                  ) : (
                    filteredMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => addMember(m.id)}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-gray-50"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                          ) : (
                            m.name[0]
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-gray-900">{m.name}</p>
                          <p className="text-[11px] text-gray-400">{m.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "생성 중..." : "프로젝트 생성"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
