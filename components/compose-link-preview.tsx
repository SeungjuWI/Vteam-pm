"use client";

import { useEffect, useRef, useState } from "react";
import { firstUrl } from "@/lib/link-preview";
import { LinkPreviewCard } from "./link-preview-card";

/**
 * 입력 중인 텍스트의 첫 URL을 슬랙처럼 입력창 바로 아래에 미리 보여준다.
 * 타이핑이 멈추면(디바운스) 카드가 뜨고, X로 닫으면 그 URL은 다시 띄우지 않는다.
 */
export function ComposeLinkPreview({ text }: { text: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const dismissed = useRef<Set<string>>(new Set());
  const [, force] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setUrl(firstUrl(text)), 350);
    return () => clearTimeout(id);
  }, [text]);

  if (!url || dismissed.current.has(url)) return null;

  return (
    <div className="px-3 pb-2">
      <LinkPreviewCard
        url={url}
        onClose={() => {
          dismissed.current.add(url);
          force((n) => n + 1);
        }}
      />
    </div>
  );
}
