"use client";

import { useEffect, useState } from "react";
import { fetchLinkPreview, extractUrls, splitByUrls, type LinkPreview } from "@/lib/link-preview";

// 인라인 링크 앞의 작은 체인 아이콘 (슬랙 스타일)
function LinkGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="mr-0.5 inline-block h-3.5 w-3.5 shrink-0 align-[-2px]"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.828 10.172a4 4 0 010 5.657l-3 3a4 4 0 01-5.657-5.657l1.5-1.5M10.172 13.828a4 4 0 010-5.657l3-3a4 4 0 015.657 5.657l-1.5 1.5"
      />
    </svg>
  );
}

/**
 * 슬랙풍 인라인 링크. URL은 체인 아이콘 + 파란색, 평소엔 밑줄 없이 hover 때만 밑줄.
 * 이메일은 mailto. isMine(파란 말풍선)일 땐 흰색으로.
 */
export function InlineLink({
  kind,
  text,
  isMine = false,
}: {
  kind: "url" | "email";
  text: string;
  isMine?: boolean;
}) {
  const href = kind === "email" ? `mailto:${text}` : text;
  return (
    <a
      href={href}
      {...(kind === "url" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={(e) => e.stopPropagation()}
      className={`break-all font-medium underline-offset-2 hover:underline ${
        isMine ? "text-white/95" : "text-blue-500"
      }`}
    >
      {kind === "url" && <LinkGlyph />}
      {text}
    </a>
  );
}

/**
 * 메시지 본문 텍스트에서 URL/이메일만 클릭 가능한 링크로 렌더한다.
 * 줄바꿈(\n) 등 일반 텍스트는 그대로 두므로, 링크는 줄이 바뀌면 자연히 끊기고
 * 다음 줄은 다시 일반(검정) 텍스트로 나온다. (splitByUrls가 \n에서 끊어줌)
 */
export function LinkifiedText({ text, isMine = false }: { text: string; isMine?: boolean }) {
  const segs = splitByUrls(text);
  return (
    <>
      {segs.map((s, i) =>
        s.kind === "text" ? (
          <span key={i}>{s.text}</span>
        ) : (
          <InlineLink key={i} kind={s.kind} text={s.text} isMine={isMine} />
        )
      )}
    </>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** 단일 URL의 미리보기 카드. 메타가 없으면 아무것도 렌더하지 않음. */
export function LinkPreviewCard({
  url,
  onClose,
  align = "left",
}: {
  url: string;
  onClose?: () => void;
  align?: "left" | "right";
}) {
  const [data, setData] = useState<LinkPreview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetchLinkPreview(url).then((d) => {
      if (!alive) return;
      if (d && (d.title || d.description || d.image)) {
        setData(d);
        setState("ready");
      } else {
        setState("empty");
      }
    });
    return () => {
      alive = false;
    };
  }, [url]);

  if (state === "empty") return null;

  if (state === "loading") {
    return (
      <div className={`mt-1 w-full max-w-[320px] animate-pulse rounded-xl border border-gray-100 bg-gray-50 p-3 ${align === "right" ? "ml-auto" : ""}`}>
        <div className="h-3 w-2/3 rounded bg-gray-200" />
        <div className="mt-2 h-2.5 w-full rounded bg-gray-100" />
      </div>
    );
  }

  const d = data!;
  return (
    <div className={`relative mt-1 w-full max-w-[320px] ${align === "right" ? "ml-auto" : ""}`}>
      <a
        href={d.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors hover:border-gray-300 hover:bg-gray-50"
      >
        <div className="flex">
          <div className="w-1 shrink-0 bg-blue-400" />
          <div className="min-w-0 flex-1 p-3">
            <p className="truncate text-[11px] font-medium text-gray-400">{d.siteName ?? hostOf(d.url)}</p>
            {d.title && (
              <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-gray-900">{d.title}</p>
            )}
            {d.description && (
              <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-gray-500">{d.description}</p>
            )}
          </div>
          {d.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.image}
              alt=""
              loading="lazy"
              className="h-auto w-20 shrink-0 self-stretch object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
      </a>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="미리보기 닫기"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:text-gray-700"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** 메시지 본문 속 URL들의 미리보기 카드 묶음 (최대 2개). */
export function MessageLinkPreviews({ content, align = "left" }: { content: string | null | undefined; align?: "left" | "right" }) {
  const urls = extractUrls(content).slice(0, 2);
  if (urls.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {urls.map((u) => (
        <LinkPreviewCard key={u} url={u} align={align} />
      ))}
    </div>
  );
}
