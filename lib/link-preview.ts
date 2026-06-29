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
