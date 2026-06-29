import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// 캐시 유효기간 (7일). 실패 캐시는 더 짧게(6시간) 잡아 일시적 오류는 곧 재시도.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAIL_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024; // 본문 512KB만 읽음

type Preview = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

// ── SSRF 방지: 사설/로컬 대역 차단 ────────────────────────────────
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    return false;
  }
  const v = ip.toLowerCase();
  if (v === "::1" || v === "::") return true;
  if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return true;
  // IPv4-mapped (::ffff:10.0.0.1 등)
  const mapped = v.split(":").pop() ?? "";
  if (net.isIPv4(mapped)) return isPrivateIp(mapped);
  return false;
}

async function isSafeHost(hostname: string): Promise<boolean> {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (net.isIP(hostname)) return !isPrivateIp(hostname);
  try {
    const addrs = await dns.lookup(hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

// ── HTML 엔티티 최소 디코딩 ──────────────────────────────────────
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ── OG / 메타 파싱 ──────────────────────────────────────────────
function parseMeta(html: string, baseUrl: string): Preview {
  const metas = html.match(/<meta\s+[^>]*>/gi) ?? [];
  const pick = (keys: string[]): string | undefined => {
    for (const tag of metas) {
      const key = (tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1] ?? "").toLowerCase();
      if (key && keys.includes(key)) {
        const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
        if (content && content.trim()) return decodeEntities(content);
      }
    }
    return undefined;
  };

  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const title = pick(["og:title", "twitter:title"]) ?? (titleTag ? decodeEntities(titleTag) : undefined);
  const description = pick(["og:description", "twitter:description", "description"]);
  const siteName = pick(["og:site_name", "application-name"]);
  let image = pick(["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"]);

  // 상대 경로 og:image → 절대 경로 보정
  if (image) {
    try {
      image = new URL(image, baseUrl).href;
    } catch {
      image = undefined;
    }
  }

  return { url: baseUrl, title, description, image, siteName };
}

function hasContent(p: Preview): boolean {
  return !!(p.title || p.description || p.image);
}

export async function GET(req: NextRequest) {
  // 로그인 사용자만 사용 가능
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url required" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "unsupported protocol" }, { status: 400 });
  }

  const canonical = target.href;
  const admin = createAdminClient();

  // 1) 캐시 확인
  const { data: cached } = await admin
    .from("link_previews")
    .select("url, title, description, image, site_name, ok, fetched_at")
    .eq("url", canonical)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    const ttl = cached.ok ? CACHE_TTL_MS : FAIL_TTL_MS;
    if (age < ttl) {
      if (!cached.ok) return NextResponse.json({ preview: null });
      return NextResponse.json({
        preview: {
          url: cached.url,
          title: cached.title ?? undefined,
          description: cached.description ?? undefined,
          image: cached.image ?? undefined,
          siteName: cached.site_name ?? undefined,
        } satisfies Preview,
      });
    }
  }

  // 2) SSRF 검사 후 fetch
  const saveFail = async () => {
    await admin.from("link_previews").upsert({ url: canonical, ok: false, fetched_at: new Date().toISOString() });
  };

  if (!(await isSafeHost(target.hostname))) {
    await saveFail();
    return NextResponse.json({ preview: null });
  }

  let html = "";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(canonical, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        // 일부 사이트가 봇 UA를 막아 일반 브라우저 UA 사용
        "user-agent": "Mozilla/5.0 (compatible; vtmLinkPreview/1.0; +https://vtm.app)",
        accept: "text/html,application/xhtml+xml",
      },
    }).finally(() => clearTimeout(timer));

    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("text/html") || !res.body) {
      await saveFail();
      return NextResponse.json({ preview: null });
    }

    // 본문을 MAX_BYTES까지만 읽음
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    reader.cancel().catch(() => {});
    html = new TextDecoder("utf-8").decode(concat(chunks));
  } catch {
    await saveFail();
    return NextResponse.json({ preview: null });
  }

  const preview = parseMeta(html, canonical);
  if (!hasContent(preview)) {
    await saveFail();
    return NextResponse.json({ preview: null });
  }

  // 3) 캐시에 저장
  await admin.from("link_previews").upsert({
    url: canonical,
    title: preview.title ?? null,
    description: preview.description ?? null,
    image: preview.image ?? null,
    site_name: preview.siteName ?? null,
    ok: true,
    fetched_at: new Date().toISOString(),
  });

  return NextResponse.json({ preview });
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}
