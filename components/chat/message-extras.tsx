"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { splitByUrls } from "@/lib/link-preview";

export type AttachmentType = "image" | "video" | "file";

export interface Attachment {
  url: string;
  type: AttachmentType;
  name: string;
}

// 메시지의 첨부를 배열로 정규화한다.
// 신규 메시지는 attachments(배열)를, 레거시 메시지는 단일 attachment_* 컬럼을 사용한다.
export function normalizeAttachments(msg: {
  attachments?: Attachment[] | null;
  attachment_url?: string | null;
  attachment_type?: AttachmentType | null;
  attachment_name?: string | null;
}): Attachment[] {
  if (msg.attachments && msg.attachments.length > 0) return msg.attachments;
  if (msg.attachment_url) {
    return [
      {
        url: msg.attachment_url,
        type: msg.attachment_type ?? "file",
        name: msg.attachment_name ?? "파일",
      },
    ];
  }
  return [];
}

// ===== 메시지 본문 렌더 (멘션 @[이름](uid) + 굵게 **텍스트**) =====
const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;

// 일반 텍스트 안의 URL/이메일을 클릭 가능한 링크로. 줄바꿈(\n)에서 끊겨 다음 줄은 일반 텍스트.
function linkify(text: string, keyPrefix: string): ReactNode[] {
  const segs = splitByUrls(text);
  if (segs.length === 1 && segs[0].kind === "text") return [text];
  return segs.map((s, i) => {
    if (s.kind === "text") return s.text;
    const href = s.kind === "email" ? `mailto:${s.text}` : s.text;
    return (
      <a
        key={`${keyPrefix}-l${i}`}
        href={href}
        {...(s.kind === "url" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        onClick={(e) => e.stopPropagation()}
        className="break-all text-blue-600 underline underline-offset-2 hover:text-blue-700"
      >
        {s.text}
      </a>
    );
  });
}

function renderInline(
  text: string,
  currentUserId: string | undefined,
  keyPrefix: string
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  MENTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(text))) {
    if (m.index > last) nodes.push(...linkify(text.slice(last, m.index), `${keyPrefix}-p${i}`));
    const name = m[1];
    const uid = m[2];
    const isMe = !!currentUserId && uid === currentUserId;
    nodes.push(
      <span
        key={`${keyPrefix}-m${i++}`}
        className={
          isMe
            ? "rounded bg-blue-100 px-1 font-semibold text-blue-700"
            : "font-semibold text-blue-600"
        }
      >
        @{name}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(...linkify(text.slice(last), `${keyPrefix}-e`));
  return nodes;
}

export function MessageContent({
  text,
  currentUserId,
}: {
  text: string;
  currentUserId?: string;
}) {
  const parts: ReactNode[] = [];
  const BOLD_RE = /\*\*([\s\S]+?)\*\*/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = BOLD_RE.exec(text))) {
    if (m.index > last)
      parts.push(...renderInline(text.slice(last, m.index), currentUserId, `t${i}`));
    parts.push(
      <strong key={`b${i}`} className="font-bold">
        {renderInline(m[1], currentUserId, `b${i}i`)}
      </strong>
    );
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length)
    parts.push(...renderInline(text.slice(last), currentUserId, `t${i}`));
  return <>{parts}</>;
}

// ===== 이미지 라이트박스 (슬랙식 모달) =====
function ImageLightbox({
  url,
  name,
  onClose,
}: {
  url: string;
  name: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 상단 바: 파일명 + 원본 열기 + 닫기 */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-5 py-4">
        <span className="max-w-[60%] truncate text-sm text-white/80">
          {name ?? "image"}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download={name ?? undefined}
            onClick={(e) => e.stopPropagation()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/20"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            원본
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
            title="닫기 (Esc)"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={name ?? "image"}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
      />
    </div>,
    document.body
  );
}

// ===== 첨부 렌더링 (이미지/영상/파일) =====
export function AttachmentView({
  url,
  type,
  name,
  isMine,
  grid,
}: {
  url: string;
  type: AttachmentType | null;
  name: string | null;
  isMine: boolean;
  // 여러 이미지를 격자로 보여줄 때 정사각 썸네일로 렌더 (슬랙식)
  grid?: boolean;
}) {
  const [zoomed, setZoomed] = useState(false);

  if (type === "image") {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name ?? "image"}
          onClick={() => setZoomed(true)}
          className={
            grid
              ? "h-32 w-full cursor-zoom-in rounded-xl object-cover transition-opacity hover:opacity-90"
              : "max-h-60 max-w-full cursor-zoom-in rounded-xl object-cover transition-opacity hover:opacity-90"
          }
        />
        {zoomed && (
          <ImageLightbox url={url} name={name} onClose={() => setZoomed(false)} />
        )}
      </>
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

// ===== 파일 드래그 앤 드롭 첨부 =====
// 바탕화면/파일에서 끌어다 놓으면 onFiles(files)로 넘긴다. 컨테이너에 dropHandlers를 spread.
export function useFileDrop(
  onFiles: (files: File[]) => void,
  disabled?: boolean
) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const hasFiles = (e: ReactDragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const dropHandlers = {
    onDragEnter: (e: ReactDragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver: (e: ReactDragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
    },
    onDragLeave: (e: ReactDragEvent) => {
      if (disabled) return;
      e.preventDefault();
      depth.current -= 1;
      if (depth.current <= 0) {
        depth.current = 0;
        setDragging(false);
      }
    },
    onDrop: (e: ReactDragEvent) => {
      if (disabled) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) onFiles(files);
    },
  };

  return { dragging, dropHandlers };
}

// 드래그 중 표시되는 첨부 안내 오버레이 (컨테이너는 relative여야 함)
export function DropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/85">
      <div className="flex flex-col items-center gap-1.5 text-blue-600">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 7.5L12 3m0 0L7.5 7.5M12 3v13.5" />
        </svg>
        <span className="text-sm font-medium">여기에 놓아 첨부</span>
      </div>
    </div>
  );
}

// ===== 다중 첨부 렌더링 (이미지는 격자, 영상/파일은 세로 나열) =====
export function AttachmentList({
  attachments,
  isMine,
}: {
  attachments: Attachment[];
  isMine: boolean;
}) {
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.type === "image");
  const others = attachments.filter((a) => a.type !== "image");

  return (
    <div className="flex flex-col gap-1.5">
      {images.length > 0 && (
        <div
          className={`grid w-full max-w-xs gap-1 ${
            images.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {images.map((a, i) => (
            <AttachmentView
              key={`img-${i}-${a.url}`}
              url={a.url}
              type={a.type}
              name={a.name}
              isMine={isMine}
              grid={images.length > 1}
            />
          ))}
        </div>
      )}
      {others.map((a, i) => (
        <AttachmentView
          key={`file-${i}-${a.url}`}
          url={a.url}
          type={a.type}
          name={a.name}
          isMine={isMine}
        />
      ))}
    </div>
  );
}

// ===== 전송 전 대기 중인 첨부 미리보기 (썸네일 + 개별 제거) =====
export function PendingAttachments({
  items,
  onRemove,
  size = "md",
}: {
  items: Attachment[];
  onRemove: (index: number) => void;
  size?: "sm" | "md";
}) {
  if (items.length === 0) return null;
  const box = size === "sm" ? "h-12 w-12" : "h-14 w-14";

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {items.map((item, i) => (
        <div
          key={`${i}-${item.url}`}
          className="group/att relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
        >
          {item.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt={item.name}
              className={`${box} object-cover`}
            />
          ) : (
            <span
              className={`${box} flex flex-col items-center justify-center gap-0.5 p-1 text-gray-500`}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span className="w-full truncate text-center text-[9px] leading-tight">
                {item.name}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover/att:opacity-100"
            title="첨부 제거"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
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
  onPicked: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onPicked(files);
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
