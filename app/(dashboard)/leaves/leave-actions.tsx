"use client";

import { approveLeave, rejectLeave } from "./actions";
import { useT } from "@/lib/i18n";

export default function LeaveActions({ leaveId }: { leaveId: string }) {
  const t = useT();
  return (
    <div className="flex gap-2">
      <button
        onClick={() => approveLeave(leaveId)}
        className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98]"
      >
        {t("leaves.approve")}
      </button>
      <button
        onClick={() => rejectLeave(leaveId)}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
      >
        {t("leaves.reject")}
      </button>
    </div>
  );
}
