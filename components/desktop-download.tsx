"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

const VERSION = "0.1.0";
const BASE_URL = "https://github.com/SeungjuWI/Vteam-pm/releases/download";

type Platform = "mac-arm" | "mac-intel" | "windows" | "unknown";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (ua.includes("Win")) return "windows";
  if (ua.includes("Mac")) {
    // Apple Silicon 감지 (WebGL renderer 기반)
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl");
      if (gl) {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        if (ext) {
          const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
          if (renderer.includes("Apple")) return "mac-arm";
        }
      }
    } catch {}
    return "mac-intel";
  }
  return "unknown";
}

export default function DesktopDownload({ variant = "full" }: { variant?: "full" | "compact" }) {
  const t = useT();
  const [isElectron, setIsElectron] = useState(false);
  const [platform, setPlatform] = useState<Platform>("unknown");

  const DOWNLOADS: Record<Exclude<Platform, "unknown">, { label: string; file: string; desc: string }> = {
    "mac-arm": {
      label: "Mac (Apple Silicon)",
      file: `${BASE_URL}/v${VERSION}/Vteam-${VERSION}-arm64.dmg`,
      desc: "M1 / M2 / M3 / M4",
    },
    "mac-intel": {
      label: "Mac (Intel)",
      file: `${BASE_URL}/v${VERSION}/Vteam-${VERSION}.dmg`,
      desc: t("desktop.macBefore2020"),
    },
    windows: {
      label: "Windows",
      file: `${BASE_URL}/v${VERSION}/Vteam-Setup-${VERSION}.exe`,
      desc: t("desktop.windowsReq"),
    },
  };

  useEffect(() => {
    setIsElectron(!!(window as unknown as { electron?: unknown }).electron);
    setPlatform(detectPlatform());
  }, []);

  if (isElectron) return null;

  const recommended = platform !== "unknown" ? DOWNLOADS[platform] : null;

  if (variant === "compact") {
    return (
      <a
        href={recommended?.file ?? `${BASE_URL}/v${VERSION}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600"
      >
        <MonitorIcon className="h-3.5 w-3.5" />
        {t("desktop.compactLabel")}
      </a>
    );
  }

  const otherPlatforms = (Object.keys(DOWNLOADS) as Exclude<Platform, "unknown">[]).filter(
    (k) => k !== platform
  );

  return (
    <div className="rounded-xl bg-white p-6">
      <h2 className="mb-4 text-sm font-medium text-gray-900">{t("desktop.title")}</h2>

      {/* 추천 다운로드 */}
      {recommended && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <MonitorIcon className="h-5 w-5 text-gray-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">vtm for {recommended.label}</p>
              <p className="text-xs text-gray-500">{recommended.desc}</p>
            </div>
          </div>
          <a
            href={recommended.file}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            {t("desktop.download")}
          </a>
        </div>
      )}

      {/* 다른 플랫폼 */}
      {otherPlatforms.length > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-gray-600">{t("desktop.otherVersions")}</span>
          {otherPlatforms.map((key) => (
            <a
              key={key}
              href={DOWNLOADS[key].file}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 underline decoration-gray-300 transition-colors hover:text-gray-700"
            >
              {DOWNLOADS[key].label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
    </svg>
  );
}
