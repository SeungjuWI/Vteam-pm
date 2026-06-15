// 출퇴근 IP 제한용 유틸.
// Vercel은 클라이언트 IP를 x-forwarded-for 헤더 맨 앞 항목에 채워준다(IPv4 또는 IPv6).
// 외부 의존성 없이 IPv4 / IPv6 / IPv4-mapped(::ffff:a.b.c.d)와 CIDR 대역 매칭을 처리한다.
// tsconfig target이 ES2017이라 BigInt 리터럴(0n) 대신 BigInt() 생성자를 쓴다.

type ParsedIp = { version: 4 | 6; value: bigint };

const ZERO = BigInt(0);
const B8 = BigInt(8);
const B16 = BigInt(16);
const B32 = BigInt(32);
const MASK16 = BigInt(0xffff);
const MASK32 = BigInt(0xffffffff);

function ipv4ToBigInt(s: string): bigint | null {
  const parts = s.split(".");
  if (parts.length !== 4) return null;
  let v = ZERO;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    v = (v << B8) | BigInt(n);
  }
  return v;
}

// IPv6 끝에 박힌 IPv4(::ffff:1.2.3.4)를 두 개의 16비트 그룹으로 바꿔준다.
function expandEmbeddedV4(s: string): string | null {
  if (!s.includes(".")) return s;
  const idx = s.lastIndexOf(":");
  if (idx === -1) return null;
  const v4 = ipv4ToBigInt(s.slice(idx + 1));
  if (v4 === null) return null;
  const hi = (v4 >> B16) & MASK16;
  const lo = v4 & MASK16;
  return `${s.slice(0, idx + 1)}${hi.toString(16)}:${lo.toString(16)}`;
}

function ipv6ToBigInt(input: string): bigint | null {
  const expanded = expandEmbeddedV4(input.split("%")[0]); // %zone-id 제거
  if (expanded === null) return null;

  const halves = expanded.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - (head.length + tail.length);
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill("0"), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;

  let v = ZERO;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    v = (v << B16) | BigInt(parseInt(g, 16));
  }
  return v;
}

function parseIp(raw: string): ParsedIp | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.includes(":")) {
    const value = ipv6ToBigInt(s);
    if (value === null) return null;
    // IPv4-mapped(::ffff:0:0/96)는 IPv4로 정규화해 v4 CIDR과도 매칭되게 한다.
    if ((value >> B32) === MASK16) return { version: 4, value: value & MASK32 };
    return { version: 6, value };
  }
  const value = ipv4ToBigInt(s);
  if (value === null) return null;
  return { version: 4, value };
}

function matchCidr(ip: ParsedIp, cidr: string): boolean {
  const [netStr, prefixStr, ...rest] = cidr.trim().split("/");
  if (rest.length) return false;

  const net = parseIp(netStr);
  if (!net || net.version !== ip.version) return false;

  const bits = net.version === 4 ? 32 : 128;
  let prefix: number;
  if (prefixStr === undefined) {
    prefix = bits; // 단일 IP는 풀 프리픽스(/32, /128)
  } else {
    prefix = Number(prefixStr);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return false;
  }

  if (prefix === 0) return true;
  const shift = BigInt(bits - prefix);
  return (ip.value >> shift) === (net.value >> shift);
}

/** ip(문자열)가 허용 CIDR 목록 중 하나에 속하면 true. */
export function ipMatchesAny(ip: string, cidrs: string[]): boolean {
  const parsed = parseIp(ip);
  if (!parsed) return false;
  return cidrs.some((c) => c.trim() && matchCidr(parsed, c));
}

/** 정책 저장 시 입력값 검증. 단일 IP(프리픽스 생략)와 CIDR 대역 모두 허용. */
export function isValidCidr(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  const [netStr, prefixStr, ...rest] = t.split("/");
  if (rest.length) return false;
  const net = parseIp(netStr);
  if (!net) return false;
  if (prefixStr === undefined) return true;
  const bits = net.version === 4 ? 32 : 128;
  const prefix = Number(prefixStr);
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= bits;
}

/** 요청 헤더에서 클라이언트 IP를 뽑는다. Vercel은 x-forwarded-for 맨 앞에 실제 IP를 채운다. */
export function getClientIp(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip");
  return real ? real.trim() : null;
}
