import Link from "next/link";

export default function AdminTabs({ active }: { active: "signup" | "insights" }) {
  const base = "px-4 py-2 text-sm border-b-2 -mb-px transition-colors";
  const on = "border-gray-900 font-semibold text-gray-900";
  const off = "border-transparent text-gray-500 hover:text-gray-700";
  return (
    <div className="mb-6 flex gap-1 border-b border-gray-100">
      <Link href="/admin" className={`${base} ${active === "signup" ? on : off}`}>
        가입현황
      </Link>
      <Link href="/admin/insights" className={`${base} ${active === "insights" ? on : off}`}>
        업무 인사이트
      </Link>
    </div>
  );
}
