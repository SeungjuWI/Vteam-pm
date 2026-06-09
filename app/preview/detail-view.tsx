"use client";

// [DEV] 프로젝트 상세 — 마일스톤(타임라인) | 보드 뷰 토글. 디자인 확인용.
import { useState } from "react";
import Link from "next/link";
import TimelineMock from "./timeline-mock";
import BoardMock from "./board-mock";

export default function DetailView({ projectName }: { projectName: string }) {
  const [view, setView] = useState<"timeline" | "board">("timeline");

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <Link href="/preview" className="inline-flex w-fit items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          프로젝트 목록
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">{projectName}</h1>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
            {([
              { key: "timeline", label: "마일스톤" },
              { key: "board", label: "보드" },
            ] as const).map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v.key ? "bg-white text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {view === "timeline" ? <TimelineMock /> : <BoardMock />}
      </div>
    </div>
  );
}
