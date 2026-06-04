import { cache } from "react";
import { createClient } from "./server";
import { createAdminClient } from "./admin";

export type AuthUser = { id: string; email: string | null };

// getUser()는 매 호출마다 Supabase 인증 서버로 네트워크 왕복(토큰 검증)을 한다.
// getClaims()는 비대칭 서명키가 켜져 있으면 JWKS를 캐시해 서명을 로컬 검증하므로
// 왕복이 사라진다. (대칭키 프로젝트면 내부적으로 getUser()로 폴백 → 동작/보안 동일)
// 만료 토큰 갱신은 getClaims가 부르는 getSession()의 __loadSession 경로에서 그대로 처리된다.
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    id: claims.sub as string,
    email: (claims.email as string | undefined) ?? null,
  };
});

export const getProfile = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, status, role, language, name, position, avatar_url")
    .eq("id", user.id)
    .single();

  return profile;
});
