"use client";

import { useState } from "react";
import Avatar from "@/components/avatar";
import MemberDetailModal from "./member-detail-modal";
import { useT } from "@/lib/i18n";

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  position: string;
  avatarUrl: string;
};

const ROLE_KEYS: Record<string, string> = {
  admin: "role.admin",
  employee: "role.employee",
};

export default function MemberList({
  members,
  isManager,
}: {
  members: Member[];
  isManager: boolean;
}) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <div className="rounded-xl bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-medium text-gray-900">
            {t("members.member")} <span className="ml-1 text-gray-600">{members.length}</span>
          </h2>
        </div>
        {members.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-gray-600">{t("members.empty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedId(member.id)}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Avatar url={member.avatarUrl} name={member.name} size={36} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-900">{member.name}</p>
                      {member.position && (
                        <span className="text-xs text-gray-600">{member.position}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
                    {ROLE_KEYS[member.role] ? t(ROLE_KEYS[member.role] as any) : member.role}
                  </span>
                  <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedId && (
        <MemberDetailModal
          memberId={selectedId}
          isManager={isManager}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
