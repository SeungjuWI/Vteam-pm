"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CompanyChip from "@/components/company-chip";
import WorkTimer from "@/components/work-timer";
import NotificationButton from "@/components/notification-button";
import ProfileMenu from "@/components/profile-menu";
import DmChatManager from "@/components/dm-chat-manager";
import { I18nProvider, LocaleProvider, makeT, type TFunction } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/ko";

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: string;
  managerOnly?: boolean;
}

const mainNavItems: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: "home" },
  { href: "/my-tasks", labelKey: "nav.myTasks", icon: "mytasks" },
  { href: "/attendance", labelKey: "nav.attendance", icon: "clock" },
  { href: "/leaves", labelKey: "nav.leaves", icon: "calendar" },
  { href: "/projects", labelKey: "nav.projects", icon: "folder" },
  { href: "/members", labelKey: "nav.members", icon: "users" },
  { href: "/org-chart", labelKey: "nav.orgChart", icon: "orgchart" },
  { href: "/settings/company", labelKey: "nav.companyInfo", icon: "building" },
  { href: "/settings/account", labelKey: "nav.settings", icon: "settings" },
];

const managerNavItems: NavItem[] = [
  { href: "/attendance-dashboard", labelKey: "nav.attendanceDashboard", icon: "chart", managerOnly: true },
  { href: "/export", labelKey: "nav.export", icon: "download", managerOnly: true },
];

const iconMap: Record<string, React.ReactNode> = {
  home: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  mytasks: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  clock: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chart: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  calendar: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  folder: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  download: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  orgchart: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  settings: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  building: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  ),
};

export interface ProfileData {
  name: string;
  role: string;
  position: string;
  avatarUrl: string;
}

export interface CompanyData {
  name: string;
  foundedAt: string | null;
  memberCount: number;
  businessNumber: string | null;
  corpNumber: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
}

export interface WorkStatus {
  status: "idle" | "working" | "done";
  clockIn: string | null;
}

export default function DashboardShell({
  children,
  role,
  userId,
  userEmail,
  userLang,
  uiLang,
  profileData,
  companyData,
  initialWorkStatus,
}: {
  children: React.ReactNode;
  role: string;
  userId: string;
  userEmail: string;
  userLang: string;
  uiLang: string;
  profileData: ProfileData;
  companyData: CompanyData | null;
  initialWorkStatus: WorkStatus;
}) {
  const pathname = usePathname();
  const isManager = role === "manager" || role === "admin";
  const t = makeT(uiLang);

  function renderNavItem(item: NavItem) {
    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive
            ? "bg-blue-50 font-medium text-blue-500"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        {iconMap[item.icon]}
        {t(item.labelKey)}
      </Link>
    );
  }

  return (
    <I18nProvider value={t}>
    <LocaleProvider value={uiLang}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
          <div className="flex h-14 items-center px-3">
            <CompanyChip profile={profileData} company={companyData} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <nav className="px-3 py-2">
              {mainNavItems.map(renderNavItem)}

              {isManager && (
                <>
                  <div className="mb-1 mt-4 px-3 text-[11px] font-medium tracking-wide text-gray-400">
                    {t("nav.adminSection")}
                  </div>
                  {managerNavItems.map(renderNavItem)}
                </>
              )}
            </nav>
            <DmChatManager currentUserId={userId} currentUserLang={userLang} />
          </div>
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <header className="flex h-14 items-center justify-end gap-3 border-b border-gray-200 bg-white px-6">
            <WorkTimer initialStatus={initialWorkStatus} />
            <NotificationButton />
            <ProfileMenu profile={{ ...profileData, email: userEmail }} />
          </header>
          {/* Content */}
          <main className="flex-1 overflow-auto bg-gray-50 p-6">{children}</main>
        </div>
      </div>
    </LocaleProvider>
    </I18nProvider>
  );
}
