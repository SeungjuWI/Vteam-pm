import { getAuthUser } from "@/lib/supabase/auth-cache";

// 운영자(플랫폼 슈퍼어드민) 이메일 화이트리스트.
// 회사(테넌트) 경계를 넘어 전체 고객사 현황을 볼 수 있는 likelion 운영팀.
// .env 에 SUPER_ADMIN_EMAILS=a@likelion.net,b@likelion.net 형식으로 등록한다.
export function getSuperAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.toLowerCase());
}

// 현재 로그인한 사용자가 운영자인지 확인한다.
export async function getSuperAdmin(): Promise<{ id: string; email: string } | null> {
  const user = await getAuthUser();
  if (!user?.email || !isSuperAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email };
}
