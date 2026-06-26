"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const isSimple = pathname === "/settings" || pathname === "/settings/account";

  const companyTabs = [
    { href: "/settings/company", label: t("settings.companyInfoTab") },
    { href: "/settings/members", label: t("settings.members") },
    { href: "/settings/org-chart", label: t("settings.orgChart") },
    { href: "/settings/work", label: t("settings.workPolicy") },
    { href: "/settings/leave", label: t("settings.leavePolicy") },
    { href: "/settings/ip-policies", label: t("settings.ipPolicy") },
  ];

  if (isSimple) {
    const title = pathname === "/settings" ? t("settings.myProfile") : t("settings.settings");
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-gray-900">{t("settings.companyInfo")}</h1>
      <div className="flex gap-1 border-b border-gray-200">
        {companyTabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "border-b-2 border-blue-500 font-medium text-blue-500"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
