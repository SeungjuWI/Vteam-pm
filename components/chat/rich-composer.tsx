"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Avatar from "@/components/avatar";

export interface RichComposerHandle {
  getText: () => string;
  clear: () => void;
  focus: () => void;
}

interface MentionMember {
  id: string;
  name: string;
  avatar_url: string | null;
}

// contentEditable DOM → 저장용 마크업 문자열로 직렬화.
// 멘션: @[이름](uid) · 굵게: **텍스트**
function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.nodeValue ?? "").replace(/\u00A0/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;

  // 멘션 칩
  const uid = el.dataset.uid;
  if (uid) {
    const name = el.textContent?.replace(/^@/, "") ?? "";
    return `@[${name}](${uid})`;
  }

  let inner = "";
  el.childNodes.forEach((c) => {
    inner += serializeNode(c);
  });

  const tag = el.tagName;
  if (tag === "BR") return "\n";
  if (tag === "B" || tag === "STRONG") return inner ? `**${inner}**` : "";
  if (
    el.style?.fontWeight === "bold" ||
    el.style?.fontWeight === "700" ||
    Number(el.style?.fontWeight) >= 600
  ) {
    return inner ? `**${inner}**` : "";
  }
  if (tag === "DIV" && inner) return `\n${inner}`;
  return inner;
}

function serializeEditor(root: HTMLElement): string {
  let out = "";
  root.childNodes.forEach((c) => {
    out += serializeNode(c);
  });
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export const RichComposer = forwardRef<RichComposerHandle, {
  members: MentionMember[];
  placeholder?: string;
  disabled?: boolean;
  onSubmit: () => void;
  onTextChange?: (hasText: boolean) => void;
}>(function RichComposer(
  { members, placeholder, disabled, onSubmit, onTextChange },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);
  // 멘션 드롭다운 상태
  const [mention, setMention] = useState<{
    items: MentionMember[];
    index: number;
    node: Text;
    at: number; // '@' 위치
    end: number; // 캐럿 위치
  } | null>(null);

  const syncEmpty = useCallback(() => {
    const txt = editorRef.current?.textContent ?? "";
    const isEmpty = txt.trim().length === 0;
    setEmpty(isEmpty);
    onTextChange?.(!isEmpty);
  }, [onTextChange]);

  useImperativeHandle(
    ref,
    () => ({
      getText: () => (editorRef.current ? serializeEditor(editorRef.current) : ""),
      clear: () => {
        if (editorRef.current) editorRef.current.innerHTML = "";
        setMention(null);
        setEmpty(true);
        onTextChange?.(false);
      },
      focus: () => editorRef.current?.focus(),
    }),
    [onTextChange]
  );

  // 캐럿 직전의 @쿼리 감지
  const detectMention = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;
    const offset = range.startOffset;
    const before = (node.nodeValue ?? "").slice(0, offset);
    const m = /(?:^|\s)@([^\s@]*)$/.exec(before);
    if (!m) return null;
    return {
      query: m[1],
      node: node as Text,
      at: offset - m[1].length - 1,
      end: offset,
    };
  }, []);

  const refreshMention = useCallback(() => {
    const md = detectMention();
    if (!md) {
      setMention((prev) => (prev ? null : prev));
      return;
    }
    const q = md.query.toLowerCase();
    const items = members
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 8);
    if (items.length === 0) {
      setMention((prev) => (prev ? null : prev));
      return;
    }
    setMention({ items, index: 0, node: md.node, at: md.at, end: md.end });
  }, [detectMention, members]);

  const insertMention = useCallback(
    (member: MentionMember) => {
      const m = mention;
      if (!m || !editorRef.current) return;
      try {
        const range = document.createRange();
        range.setStart(m.node, m.at);
        range.setEnd(m.node, Math.min(m.end, m.node.length));
        range.deleteContents();

        const chip = document.createElement("span");
        chip.dataset.uid = member.id;
        chip.setAttribute("contenteditable", "false");
        chip.style.color = "#3182f6";
        chip.style.fontWeight = "600";
        chip.textContent = `@${member.name}`;

        const space = document.createTextNode(" ");
        range.insertNode(space);
        range.insertNode(chip);

        // 캐럿을 공백 뒤로
        const sel = window.getSelection();
        const after = document.createRange();
        after.setStartAfter(space);
        after.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(after);
      } catch {
        // 노드가 바뀐 경우 무시
      }
      setMention(null);
      syncEmpty();
      editorRef.current.focus();
    },
    [mention, syncEmpty]
  );

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // 멘션 드롭다운 열림 → 방향키/엔터/Esc 가로채기
    if (mention) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMention((p) =>
          p ? { ...p, index: (p.index + 1) % p.items.length } : p
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMention((p) =>
          p
            ? { ...p, index: (p.index - 1 + p.items.length) % p.items.length }
            : p
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mention.items[mention.index]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }

    // 굵게: Cmd/Ctrl + B
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand("bold");
      return;
    }

    // 줄바꿈: Shift + Enter
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      document.execCommand("insertText", false, "\n");
      syncEmpty();
      return;
    }

    // 전송: Enter
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative flex-1">
      {/* 멘션 추천 드롭다운 */}
      {mention && (
        <div className="absolute bottom-full left-0 z-30 mb-1 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-soft-md">
          {mention.items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              // mousedown에서 처리해 editor blur보다 먼저 실행
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(item);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                i === mention.index
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Avatar url={item.avatar_url} name={item.name} size={22} />
              <span className="truncate font-medium">{item.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* 입력 영역 (빈 상태일 때 placeholder 오버레이) */}
      {empty && (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
          {placeholder}
        </span>
      )}
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={() => {
          syncEmpty();
          refreshMention();
        }}
        onKeyUp={(e) => {
          // 방향키/클릭으로 캐럿 이동 시에도 멘션 상태 갱신
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            refreshMention();
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setMention(null), 100)}
        className="max-h-32 min-h-[2.625rem] w-full overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm leading-relaxed text-gray-900 focus:border-blue-300 focus:bg-white focus:outline-none"
      />
    </div>
  );
});
