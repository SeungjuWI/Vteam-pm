"use client";

import { useRef, useState } from "react";
import { saveWelcomeProfile } from "./actions";
import { compressImage } from "@/lib/compress-image";
import LanguageSelect from "@/components/language-select";

interface Props {
  companyName: string;
  companyLogoUrl: string;
}

export default function WelcomeForm({ companyName, companyLogoUrl }: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const compressedRef = useRef<Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다");
      return;
    }
    try {
      const { blob, dataUrl } = await compressImage(file, 256);
      compressedRef.current = blob;
      setAvatarPreview(dataUrl);
      setError("");
    } catch {
      setError("이미지 처리에 실패했습니다");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    if (compressedRef.current) {
      formData.delete("avatar");
      formData.set(
        "avatar",
        new File([compressedRef.current], "avatar.webp", {
          type: compressedRef.current.type,
        })
      );
    }

    const result = await saveWelcomeProfile(formData);
    if (result?.error) {
      setError(result.error);
    }
    setSaving(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8">
        {/* 헤더: 회사 로고 + 이름 */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">환영합니다!</h1>
          {companyName && (
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2">
              {companyLogoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={companyLogoUrl}
                  alt={companyName}
                  className="h-5 w-5 rounded object-contain"
                />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-[10px] font-semibold text-blue-600">
                  {companyName[0]}
                </div>
              )}
              <span className="text-sm font-medium text-gray-900">
                {companyName}
              </span>
            </div>
          )}
          <p className="text-sm text-gray-500">
            시작하기 전에 프로필을 설정해주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* 프로필 사진 */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 transition-colors hover:bg-gray-100"
              onClick={() => fileRef.current?.click()}
            >
              {avatarPreview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarPreview}
                  alt="프로필"
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg
                  className="h-8 w-8 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                  />
                </svg>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              {avatarPreview ? "사진 변경" : "프로필 사진 추가"}
            </button>
            <input
              ref={fileRef}
              type="file"
              name="avatar"
              accept="image/*,.heic,.heif"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* 이름 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              이름<span className="ml-0.5 text-red-400">*</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder="이름을 입력하세요"
              maxLength={20}
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
              required
              autoFocus
            />
          </div>

          {/* 직책 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              직책
            </label>
            <input
              type="text"
              name="position"
              placeholder="예: 프론트엔드 개발자, 디자이너, PM"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* 입사일 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              입사일
            </label>
            <input
              type="date"
              name="joinDate"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* 모국어 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              모국어
            </label>
            <LanguageSelect />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "시작하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
