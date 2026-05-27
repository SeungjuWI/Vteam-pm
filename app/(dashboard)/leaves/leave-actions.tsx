"use client";

import { approveLeave, rejectLeave } from "./actions";

export default function LeaveActions({ leaveId }: { leaveId: string }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => approveLeave(leaveId)}
        className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600"
      >
        승인
      </button>
      <button
        onClick={() => rejectLeave(leaveId)}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
      >
        거절
      </button>
    </div>
  );
}
