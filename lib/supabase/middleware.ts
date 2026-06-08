import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser()(인증 서버 왕복) 대신 getClaims()로 로컬 검증.
  // 만료 토큰 갱신은 getClaims 내부 getSession() 경로에서 그대로 수행되어
  // 새 토큰 쿠키가 supabaseResponse에 기록된다.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;

  const pathname = request.nextUrl.pathname;

  // 공개 페이지
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/invite");

  // 비로그인 → 공개 페이지만
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 로그인 → auth 페이지 접근 차단
  if (user && (pathname === "/" || pathname.startsWith("/login"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/projects"; // [DEV] 원래 /attendance — 작업 끝나면 원복
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
