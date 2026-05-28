import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DesktopDownload from "@/components/desktop-download";

const ROLE_LABELS: Record<string, string> = {
  admin: "최고관리자",
  manager: "관리자",
  employee: "직원",
};

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .single();

  const provider = user.app_metadata?.provider ?? "email";
  const providerLabel = provider === "google" ? "Google" : provider === "github" ? "GitHub" : "이메일";

  return (
    <div className="flex flex-col gap-6">
      {/* 계정 정보 */}
      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-900">계정 정보</h2>
        <div className="flex flex-col gap-3">
          <Row label="이메일" value={user.email ?? ""} />
          <Row label="역할" value={ROLE_LABELS[profile?.role ?? ""] ?? profile?.role ?? ""} />
          <Row label="가입일" value={formatDate(user.created_at)} />
        </div>
      </div>

      {/* 연동 플랫폼 */}
      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-900">연동 플랫폼</h2>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            {provider === "google" ? <GoogleIcon /> : <EmailIcon />}
            <div>
              <p className="text-sm font-medium text-gray-900">{providerLabel}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-600">연동됨</span>
        </div>
      </div>

      {/* 구독 플랜 */}
      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-900">구독 플랜</h2>
        <div className="rounded-lg border border-gray-200 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">Free</p>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">현재 플랜</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">기본 기능을 무료로 이용하세요</p>
            </div>
            <button
              disabled
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-400"
            >
              준비 중
            </button>
          </div>
        </div>
      </div>

      {/* 데스크탑 앱 */}
      <DesktopDownload />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}
