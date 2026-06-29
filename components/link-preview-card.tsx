"use client";

import { useEffect, useState } from "react";
import { fetchLinkPreview, extractUrls, type LinkPreview } from "@/lib/link-preview";

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
