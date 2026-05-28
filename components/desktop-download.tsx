"use client";

import { useEffect, useState } from "react";

const DOWNLOAD_URL = "https://github.com/wiseungju/Vteam-pm/releases/latest";

export default function DesktopDownload({ variant = "full" }: { variant?: "full" | "compact" }) {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(!!(window as unknown as { electron?: unknown }).electron);
  }, []);

  if (isElectron) return null;

  if (variant === "compact") {
    return (
      <a
        href={DOWNLOAD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
        </svg>
        데스크탑 앱 다운로드
      </a>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6">
      <h2 className="mb-4 text-sm font-medium text-gray-900">데스크탑 앱</h2>
      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-900">Vteam for Desktop</p>
            <p className="text-xs text-gray-500">macOS, Windows 지원</p>
          </div>
        </div>
        <a
          href={DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          다운로드
        </a>
      </div>
    </div>
  );
}
