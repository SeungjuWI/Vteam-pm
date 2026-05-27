"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const companyTabs = [
  { href: "/settings/company", label: "회사 정보" },
  { href: "/settings/work", label: "근무 규정" },
  { href: "/settings/leave", label: "연차 제도" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSimple = pathname === "/settings" || pathname === "/settings/account";

  if (isSimple) {
    const title = pathname === "/settings" ? "내 프로필" : "설정";
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-gray-900">회사정보</h1>
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
