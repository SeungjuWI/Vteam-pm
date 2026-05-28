"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "./profile-actions";
import { compressImage } from "@/lib/compress-image";
import LanguageSelect from "@/components/language-select";
import { LANGUAGES } from "@/lib/languages";

interface ProfileData {
  name: string;
  email: string;
  role: string;
  position: string;
  avatarUrl: string;
  language: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "최고관리자",
  manager: "관리자",
  employee: "직원",
};

export default function ProfileView({ data }: { data: ProfileData }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const compressedRef = useRef<Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);

    // 압축된 이미지가 있으면 file input 대신 사용
    if (compressedRef.current) {
      formData.delete("avatar");
      formData.set("avatar", new File([compressedRef.current], "avatar.webp", { type: compressedRef.current.type }));
    }
    if (removeAvatar && !avatarPreview) {
      formData.set("removeAvatar", "true");
    }

    const result = await saveProfile(formData);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "저장되었습니다" });
      setEditing(false);
      setAvatarPreview(null);
      setRemoveAvatar(false);
      compressedRef.current = null;
      router.refresh();
      setTimeout(() => setMessage(null), 2000);
    }
    setSaving(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "이미지 파일만 업로드 가능합니다" });
      return;
    }
    try {
      const { blob, dataUrl } = await compressImage(file, 256);
      compressedRef.current = blob;
      setAvatarPreview(dataUrl);
      setRemoveAvatar(false);
    } catch {
      setMessage({ type: "error", text: "이미지 처리에 실패했습니다" });
    }
  }

  const currentAvatar = avatarPreview || (!removeAvatar ? data.avatarUrl : "");

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">내 프로필</h2>
          <button
            type="button"
            onClick={() => { setEditing(false); setAvatarPreview(null); setRemoveAvatar(false); }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            취소
          </button>
        </div>

        {/* 프로필 사진 */}
        <div className="mb-5 flex items-center gap-4">
          <div
            className="relative flex h-16 w-16 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 transition-colors hover:bg-gray-100"
            onClick={() => fileRef.current?.click()}
          >
            {currentAvatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={currentAvatar} alt="프로필" className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-medium text-gray-400">{data.name[0]}</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-fit rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              {currentAvatar ? "변경" : "업로드"}
            </button>
            {currentAvatar && (
              <button
                type="button"
                onClick={() => { setAvatarPreview(null); setRemoveAvatar(true); if (fileRef.current) fileRef.current.value = ""; }}
                className="w-fit text-xs text-gray-400 hover:text-red-400"
              >
                삭제
              </button>
            )}
            <span className="text-[11px] text-gray-400">PNG, JPG / 최대 2MB</span>
          </div>
          <input ref={fileRef} type="file" name="avatar" accept="image/*,.heic,.heif" onChange={handleFileChange} className="hidden" />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-500">이름<span className="ml-0.5 text-red-400">*</span></label>
            <input
              name="name"
              defaultValue={data.name}
              required
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-500">포지션</label>
            <input
              name="position"
              defaultValue={data.position}
              placeholder="예: 프론트엔드 개발자, 디자이너, PM"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-300 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-500">모국어</label>
            <LanguageSelect name="language" defaultValue={data.language} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-500">이메일</label>
            <p className="px-3 py-2 text-sm text-gray-400">{data.email}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-500">역할</label>
            <p className="px-3 py-2 text-sm text-gray-400">{ROLE_LABELS[data.role] ?? data.role}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          {message && (
            <span className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-500"}`}>
              {message.text}
            </span>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">내 프로필</h2>
        <button onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:text-blue-600">
          수정
        </button>
      </div>

      {/* 프로필 사진 + 이름 */}
      <div className="mb-4 flex items-center gap-3">
        <Avatar url={data.avatarUrl} name={data.name} size={48} />
        <div>
          <p className="text-sm font-medium text-gray-900">{data.name}</p>
          {data.position && <p className="text-xs text-gray-500">{data.position}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Row label="이메일" value={data.email} />
        <Row label="역할" value={ROLE_LABELS[data.role] ?? data.role} />
        {data.position && <Row label="포지션" value={data.position} />}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">모국어</span>
          <span className="text-sm text-gray-900">
            {(() => { const l = LANGUAGES.find((l) => l.code === data.language); return l ? `${l.flag} ${l.label}` : data.language; })()}
          </span>
        </div>
      </div>

      {message && (
        <p className={`mt-3 text-sm ${message.type === "success" ? "text-green-600" : "text-red-500"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

function Avatar({ url, name, size }: { url: string; name: string; size: number }) {
  const [error, setError] = useState(false);
  const px = `${size}px`;

  if (url && !error) {
    return (
      <div className="relative flex-shrink-0 overflow-hidden rounded-full bg-gray-100" style={{ width: px, height: px }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="h-full w-full object-cover" onError={() => setError(true)} />
      </div>
    );
  }

  return (
    <div className="flex flex-shrink-0 items-center justify-center rounded-full bg-gray-100" style={{ width: px, height: px }}>
      <span className="font-medium text-gray-500" style={{ fontSize: size * 0.35 }}>{name[0]}</span>
    </div>
  );
}
