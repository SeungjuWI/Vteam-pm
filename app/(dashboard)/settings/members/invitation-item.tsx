"use client";

import { cancelInvitation } from "./actions";

type Invitation = {
  id: string;
  email: string;
  created_at: string;
};

export default function InvitationItem({ invitation }: { invitation: Invitation }) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm text-blue-500">
          @
        </div>
        <div>
          <p className="text-sm text-gray-900">{invitation.email}</p>
          <p className="text-xs text-gray-600">초대 발송됨</p>
        </div>
      </div>
      <button
        onClick={() => cancelInvitation(invitation.id)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        취소
      </button>
    </div>
  );
}
