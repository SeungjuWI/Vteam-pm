"use client";

import { useRef, useState } from "react";

export type AttachmentType = "image" | "video" | "file";

// ===== 첨부 렌더링 (이미지/영상/파일) =====
export function AttachmentView({
  url,
  type,
  name,
  isMine,
}: {
  url: string;
  type: AttachmentType | null;
  name: string | null;
  isMine: boolean;
}) {
  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name ?? "image"}
          className="max-h-60 max-w-full rounded-xl object-cover"
        />
      </a>
    );
  }
  if (type === "video") {
    return (
      <video
        src={url}
        controls
        className="max-h-60 max-w-full rounded-xl"
        preload="metadata"
      />
    );
  }
  // 일반 파일
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={name ?? undefined}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
        isMine ? "bg-blue-400/30 text-white" : "bg-gray-100 text-gray-700"
      }`}
    >
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
      <span className="max-w-40 truncate">{name ?? "파일"}</span>
    </a>
  );
}

// ===== 본인 메시지 ⋯ 액션 메뉴 (수정/삭제) =====
export function MessageActions({
  canEdit,
  onEdit,
  onDelete,
}: {
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        title="메시지 옵션"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 6.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM12 13.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM12 20.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-24 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-soft-md">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                수정
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
            >
              삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ===== 인라인 수정 입력 (자체 state라 부모 메시지 리스트를 리렌더하지 않음) =====
export function EditBox({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="flex w-full flex-col gap-1">
      <input
        ref={ref}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (value.trim()) onSave(value.trim());
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        className="rounded-2xl border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none"
      />
      <div className="flex gap-2 text-[11px] text-gray-400">
        <button type="button" onClick={() => value.trim() && onSave(value.trim())} className="hover:text-blue-500">
          저장
        </button>
        <button type="button" onClick={onCancel} className="hover:text-gray-600">
          취소
        </button>
        <span>Enter 저장 · Esc 취소</span>
      </div>
    </div>
  );
}

// ===== 첨부 업로드 버튼 (📎) — 파일 선택 시 onPicked(file) 호출 =====
export function AttachmentButton({
  onPicked,
  disabled,
}: {
  onPicked: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPicked(file);
          e.target.value = ""; // 같은 파일 다시 선택 가능하게 초기화
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        title="이미지/영상 첨부"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-[0.95] disabled:opacity-40"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
          />
        </svg>
      </button>
    </>
  );
}
