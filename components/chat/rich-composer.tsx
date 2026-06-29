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
import { splitByUrls } from "@/lib/link-preview";

const LINK_COLOR = "#3182f6";

// ── contentEditable 안에서 URL/이메일을 파랗게 칠하기 ───────────────
// 캐럿 위치(문자 오프셋) 저장/복원. 멘션 칩은 통째로 한 단위로 셈.
function getCaretOffset(root: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

function setCaretOffset(root: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  let remaining = offset;
  let placed = false;

  const walk = (node: Node): boolean => {
    if (placed) return true;
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset?.uid) {
      const len = node.textContent?.length ?? 0;
      if (remaining <= len) {
        range.setStartAfter(node);
        range.collapse(true);
        placed = true;
        return true;
      }
      remaining -= len;
      return false;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.nodeValue?.length ?? 0;
      if (remaining <= len) {
        range.setStart(node, remaining);
        range.collapse(true);
        placed = true;
        return true;
      }
      remaining -= len;
      return false;
    }
    for (const child of Array.from(node.childNodes)) {
      if (walk(child)) return true;
    }
    return false;
  };

  walk(root);
  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

function isPureLink(text: string): boolean {
  const segs = splitByUrls(text);
  return segs.length === 1 && segs[0].kind !== "text";
}

// DOM 재구성이 필요한지(새 링크 생겼거나 기존 링크 깨졌는지) 검사
function needsLinkReflow(root: HTMLElement): boolean {
  const spans = root.querySelectorAll<HTMLElement>("[data-link]");
  for (const s of spans) {
    if (!isPureLink(s.textContent ?? "")) return true;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const parent = (n as Text).parentElement;
    if (parent?.closest("[data-uid]")) continue;
    if (parent?.hasAttribute("data-link")) continue;
    if (splitByUrls(n.nodeValue ?? "").some((s) => s.kind !== "text")) return true;
  }
  return false;
}

// 기존 링크 span을 펼친 뒤 텍스트 노드를 다시 토큰화해 링크만 span으로 감싼다
function reflowLinks(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-link]").forEach((s) => {
    s.replaceWith(document.createTextNode(s.textContent ?? ""));
  });
  root.normalize();

  const texts: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const parent = (n as Text).parentElement;
    if (parent?.closest("[data-uid]")) continue;
    texts.push(n as Text);
  }

  for (const tn of texts) {
    const segs = splitByUrls(tn.nodeValue ?? "");
    if (!segs.some((s) => s.kind !== "text")) continue;
    const frag = document.createDocumentFragment();
    for (const seg of segs) {
      if (seg.kind === "text") {
        frag.appendChild(document.createTextNode(seg.text));
      } else {
        const span = document.createElement("span");
        span.setAttribute("data-link", "1");
        span.style.color = LINK_COLOR;
        span.textContent = seg.text;
        frag.appendChild(span);
      }
    }
    tn.replaceWith(frag);
  }
}

// 미리보기/URL 감지용 평문. contentEditable의 textContent는 <br>·<div> 줄바꿈을
// 누락해 "https://a.com" + 다음 줄이 붙어버린다(→ 잘못된 URL로 미리보기 실패).
// 여기서는 줄바꿈을 \n으로 보존하고 멘션 칩은 이름 그대로 둔다.
function editorPlainText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  if (el.dataset.uid) return el.textContent ?? ""; // 멘션 칩은 통째로
  if (el.tagName === "BR") return "\n";
  let inner = "";
  el.childNodes.forEach((c) => {
    inner += editorPlainText(c);
  });
  if (el.tagName === "DIV" && inner) return `\n${inner}`;
  return inner;
}

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
  onTextChange?: (hasText: boolean, text: string) => void;
}>(function RichComposer(
  { members, placeholder, disabled, onSubmit, onTextChange },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const [empty, setEmpty] = useState(true);

  // URL/이메일을 파랗게 칠함. 실패해도 입력은 절대 깨지지 않도록 try/catch.
  const linkifyNow = useCallback(() => {
    const root = editorRef.current;
    if (!root || composingRef.current) return;
    try {
      if (!needsLinkReflow(root)) return;
      const offset = getCaretOffset(root);
      reflowLinks(root);
      if (offset != null) setCaretOffset(root, offset);
    } catch {
      /* 색칠 실패 무시 */
    }
  }, []);
  // 멘션 드롭다운 상태
  const [mention, setMention] = useState<{
    items: MentionMember[];
    index: number;
    node: Text;
    at: number; // '@' 위치
    end: number; // 캐럿 위치
  } | null>(null);

  const syncEmpty = useCallback(() => {
    const root = editorRef.current;
    const txt = root ? editorPlainText(root).replace(/^\n+/, "") : "";
    const isEmpty = txt.trim().length === 0;
    setEmpty(isEmpty);
    onTextChange?.(!isEmpty, txt);
  }, [onTextChange]);

  useImperativeHandle(
    ref,
    () => ({
      getText: () => (editorRef.current ? serializeEditor(editorRef.current) : ""),
      clear: () => {
        if (editorRef.current) editorRef.current.innerHTML = "";
        setMention(null);
        setEmpty(true);
        onTextChange?.(false, "");
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
        // IME 조합 중 Enter는 조합 확정용 → 멘션 선택/전송에 쓰지 않음
        if (e.key === "Enter" && e.nativeEvent.isComposing) return;
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

    // 전송: Enter (단, 한글 등 IME 조합 중에는 전송하지 않음 → 마지막 글자 중복 방지)
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return;
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
          linkifyNow();
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          linkifyNow();
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
