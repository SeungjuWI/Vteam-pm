// 메시지/입력 텍스트에서 URL을 뽑아내고, /api/link-preview로 OG 메타를 가져온다.

export type LinkPreview = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

// http/https URL 추출. 끝의 문장부호( . , ; : ! ? ) ] } 따옴표 )는 제외.
const URL_RE = /(https?:\/\/[^\s<]+)/gi;

function trimTrailing(url: string): string {
  // 닫는 괄호 균형 맞추기 + 흔한 끝 문장부호 제거
  let u = url.replace(/[.,;:!?'"]+$/, "");
  while (/[)\]}]$/.test(u)) {
    const close = u[u.length - 1];
    const open = close === ")" ? "(" : close === "]" ? "[" : "{";
    const opens = (u.match(new RegExp("\\" + open, "g")) ?? []).length;
    const closes = (u.match(new RegExp("\\" + close, "g")) ?? []).length;
    if (closes > opens) u = u.slice(0, -1);
    else break;
  }
  return u;
}

export function extractUrls(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = text.match(URL_RE) ?? [];
  const out: string[] = [];
  for (const raw of found) {
    const u = trimTrailing(raw);
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      if (!out.includes(parsed.href)) out.push(parsed.href);
    } catch {
      /* 무시 */
    }
  }
  return out;
}

export function firstUrl(text: string | null | undefined): string | null {
  return extractUrls(text)[0] ?? null;
}

// URL 또는 이메일 매칭 (입력창/메시지 하이라이트용)
const EMAIL_RE_SRC = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";
const LINK_RE = new RegExp(`(https?:\\/\\/[^\\s<]+)|(${EMAIL_RE_SRC})`, "gi");

export type LinkSegment = { text: string; kind: "text" | "url" | "email" };

// 텍스트를 URL/이메일 조각과 일반 조각으로 분리
export function splitByUrls(text: string): LinkSegment[] {
  if (!text) return [{ text: "", kind: "text" }];
  const out: LinkSegment[] = [];
  let last = 0;
  LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(text)) !== null) {
    const start = m.index;
    const rawEnd = start + m[0].length;
    const isEmail = !!m[2];
    const trimmed = trimTrailing(m[0]);

    let ok = false;
    if (isEmail) {
      ok = trimmed.length > 0 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(trimmed);
    } else {
      try {
        const u = new URL(trimmed);
        ok = u.protocol === "http:" || u.protocol === "https:";
      } catch {
        ok = false;
      }
    }

    if (start > last) out.push({ text: text.slice(last, start), kind: "text" });
    if (ok) {
      out.push({ text: trimmed, kind: isEmail ? "email" : "url" });
      last = start + trimmed.length; // 잘려나간 끝 문장부호는 다음 일반 조각으로
    } else {
      out.push({ text: m[0], kind: "text" });
      last = rawEnd;
    }
  }
  if (last < text.length) out.push({ text: text.slice(last), kind: "text" });
  return out.length > 0 ? out : [{ text, kind: "text" }];
}

// 같은 URL을 여러 카드가 동시에 요청해도 한 번만 fetch (탭 세션 동안 메모리 캐시)
const cache = new Map<string, Promise<LinkPreview | null>>();

export function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  const cached = cache.get(url);
  if (cached) return cached;
  const p = (async (): Promise<LinkPreview | null> => {
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) return null;
      const json = (await res.json()) as { preview: LinkPreview | null };
      return json.preview ?? null;
    } catch {
      return null;
    }
  })();
  cache.set(url, p);
  // 실패(null)는 캐시에서 빼서 나중에 재시도 가능하게
  p.then((v) => {
    if (!v) cache.delete(url);
  });
  return p;
}
