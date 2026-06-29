"use client";

import React, { useEffect, useRef } from "react";
import { splitByUrls } from "@/lib/link-preview";

/**
 * 네이티브 <input>/<textarea>는 텍스트 일부만 색을 입힐 수 없으므로,
 * 같은 글꼴·여백의 "미러 레이어"를 뒤에 깔고 URL/이메일만 파랗게 칠한다.
 * 실제 입력칸은 글자색 투명 + 커서만 보이게 해서 위에 겹친다.
 *
 * - boxClassName: 테두리/배경/모서리/포커스 등 박스 외형 (wrapper에 적용, focus-within: 사용)
 * - fieldClassName: 글꼴/크기/패딩 등 타이포 (미러와 입력칸 양쪽에 동일 적용)
 */
function assignRef(
  ref: React.Ref<HTMLInputElement | HTMLTextAreaElement> | undefined,
  el: HTMLInputElement | HTMLTextAreaElement | null
) {
  if (!ref) return;
  if (typeof ref === "function") ref(el);
  else (ref as React.MutableRefObject<typeof el>).current = el;
}

function Mirror({ value, multiline }: { value: string; multiline?: boolean }) {
  const segs = splitByUrls(value);
  return (
    <>
      {segs.map((s, i) =>
        s.kind === "text" ? (
          <span key={i}>{s.text}</span>
        ) : (
          <span key={i} className="text-blue-500">
            {s.text}
          </span>
        )
      )}
      {/* textarea 마지막 줄 높이 보정 */}
      {multiline ? "\n" : null}
    </>
  );
}

export function LinkHighlightInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  multiline,
  rows,
  boxClassName = "",
  fieldClassName = "",
  wrapperClassName = "",
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  boxClassName?: string;
  fieldClassName?: string;
  wrapperClassName?: string;
  inputRef?: React.Ref<HTMLInputElement | HTMLTextAreaElement>;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const syncScroll = () => {
    const b = backdropRef.current;
    const el = innerRef.current;
    if (!b || !el) return;
    b.scrollTop = el.scrollTop;
    b.scrollLeft = el.scrollLeft;
  };

  // 값 변경(타이핑으로 캐럿이 스크롤될 때)마다 미러 스크롤 동기화
  useEffect(() => {
    syncScroll();
  }, [value]);

  const setRefs = (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    innerRef.current = el;
    assignRef(inputRef, el);
  };

  const fieldBase = `relative block w-full bg-transparent text-transparent caret-gray-900 placeholder:text-gray-400 outline-none ${fieldClassName}`;
  const mirrorBase = `pointer-events-none absolute inset-0 overflow-hidden text-gray-900 ${
    multiline ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-hidden"
  } ${fieldClassName}`;

  return (
    <div className={`relative ${wrapperClassName} ${boxClassName}`}>
      <div ref={backdropRef} aria-hidden className={mirrorBase}>
        <Mirror value={value} multiline={multiline} />
      </div>
      {multiline ? (
        <textarea
          ref={setRefs as React.Ref<HTMLTextAreaElement>}
          value={value}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          className={`${fieldBase} resize-none`}
        />
      ) : (
        <input
          ref={setRefs as React.Ref<HTMLInputElement>}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          className={fieldBase}
        />
      )}
    </div>
  );
}
