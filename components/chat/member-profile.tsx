"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Avatar from "@/components/avatar";
import { LANGUAGES } from "@/lib/languages";

export interface ChatMember {
  id: string;
  name: string;
  avatar_url: string | null;
  presence?: string | null;
  position?: string | null;
  role?: string | null;
  language?: string | null;
  email?: string | null;
}

// ===== 프레즌스(접속 상태) 표시 =====

const PRESENCE: Record<string, { label: string; dot: string; text: string }> = {
  online: { label: "온라인", dot: "bg-green-500", text: "text-green-600" },
  away: { label: "자리 비움", dot: "bg-amber-400", text: "text-amber-600" },
  offline: { label: "오프라인", dot: "bg-gray-300", text: "text-gray-400" },
};

function presenceOf(p?: string | null) {
  return PRESENCE[p ?? "offline"] ?? PRESENCE.offline;
}

function PresenceDot({
  presence,
  size = 10,
  ring = "ring-white",
}: {
  presence?: string | null;
  size?: number;
  ring?: string;
}) {
  const pr = presenceOf(presence);
  return (
    <span
      className={`inline-block shrink-0 rounded-full ring-2 ${pr.dot} ${ring}`}
      style={{ width: size, height: size }}
    />
  );
}

function roleLabel(role?: string | null) {
  if (role === "admin") return "관리자";
  if (role === "manager") return "매니저";
  if (role === "employee") return "멤버";
  return null;
}

function langOf(code?: string | null) {
  if (!code) return null;
  return LANGUAGES.find((l) => l.code === code) ?? null;
}

// ===== 호버 미니 프로필 카드 (아바타/이름에 마우스 올리면 표시) =====

export function MemberTrigger({
  member,
  onOpen,
  children,
  className,
}: {
  member: ChatMember;
  onOpen: (id: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [card, setCard] = useState<{ top: number; left: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (showTimer.current) clearTimeout(showTimer.current);
    };
  }, []);

  const open = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const CARD_W = 280;
      // 기본은 트리거 오른쪽, 화면 넘치면 왼쪽으로
      let left = r.right + 8;
      if (left + CARD_W > window.innerWidth - 8) left = r.left - CARD_W - 8;
      if (left < 8) left = 8;
      const top = Math.min(r.top, window.innerHeight - 220);
      setCard({ top: Math.max(8, top), left });
    }, 350);
  };

  const scheduleHide = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setCard(null), 120);
  };

  const pr = presenceOf(member.presence);
  const lang = langOf(member.language);
  const role = roleLabel(member.role);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={open}
        onMouseLeave={scheduleHide}
        onClick={() => {
          setCard(null);
          onOpen(member.id);
        }}
        className={className}
      >
        {children}
      </button>

      {card &&
        createPortal(
          <div
            onMouseEnter={() => {
              if (hideTimer.current) clearTimeout(hideTimer.current);
            }}
            onMouseLeave={() => setCard(null)}
            className="fixed z-[9999] w-[280px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-soft-lg"
            style={{ top: card.top, left: card.left }}
          >
            <div className="h-12 bg-gradient-to-r from-blue-500 to-blue-400" />
            <div className="px-4 pb-4">
              <div className="-mt-7 mb-2">
                <div className="relative inline-block rounded-2xl ring-4 ring-white">
                  <Avatar
                    url={member.avatar_url}
                    name={member.name}
                    size={56}
                    className="!rounded-2xl"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <PresenceDot presence={member.presence} size={14} />
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <p className="truncate text-base font-bold text-gray-900">
                  {member.name}
                </p>
              </div>
              {member.position && (
                <p className="truncate text-sm text-gray-600">{member.position}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${pr.text}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${pr.dot}`} />
                  {pr.label}
                </span>
                {role && (
                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                    {role}
                  </span>
                )}
                {lang && (
                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                    {lang.flag} {lang.label}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCard(null);
                  onOpen(member.id);
                }}
                className="mt-3 w-full rounded-lg border border-gray-200 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                프로필 보기
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// ===== 우측 프로필 패널 (클릭 시 슬랙처럼 오른쪽에 표시) =====

export function MemberProfilePanel({
  member,
  onClose,
}: {
  member: ChatMember;
  onClose: () => void;
}) {
  const pr = presenceOf(member.presence);
  const lang = langOf(member.language);
  const role = roleLabel(member.role);

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="flex h-12 items-center justify-between border-b border-gray-100 px-4">
        <span className="text-sm font-semibold text-gray-900">프로필</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="닫기"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <Avatar
              url={member.avatar_url}
              name={member.name}
              size={88}
              className="!rounded-3xl"
            />
            <span className="absolute -bottom-1 -right-1">
              <PresenceDot presence={member.presence} size={18} />
            </span>
          </div>
          <p className="mt-3 text-lg font-bold text-gray-900">{member.name}</p>
          {member.position && (
            <p className="text-sm text-gray-600">{member.position}</p>
          )}
          <span
            className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium ${pr.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${pr.dot}`} />
            {pr.label}
          </span>
        </div>

        <div className="mt-5 space-y-px overflow-hidden rounded-xl border border-gray-100">
          {role && <InfoRow label="역할" value={role} />}
          {lang && (
            <InfoRow label="사용 언어" value={`${lang.flag} ${lang.label}`} />
          )}
          {member.email && <InfoRow label="이메일" value={member.email} />}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-gray-50/60 px-4 py-2.5">
      <span className="shrink-0 text-xs font-medium text-gray-500">{label}</span>
      <span className="truncate text-sm text-gray-800">{value}</span>
    </div>
  );
}

// ===== 우측 멤버 목록 패널 (헤더 멤버수 클릭 시) =====

export function MembersListPanel({
  members,
  onClose,
  onOpenMember,
}: {
  members: ChatMember[];
  onClose: () => void;
  onOpenMember: (id: string) => void;
}) {
  // 온라인 → 자리비움 → 오프라인, 그 안에서 이름순
  const order: Record<string, number> = { online: 0, away: 1, offline: 2 };
  const sorted = [...members].sort((a, b) => {
    const oa = order[a.presence ?? "offline"] ?? 2;
    const ob = order[b.presence ?? "offline"] ?? 2;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="flex h-12 items-center justify-between border-b border-gray-100 px-4">
        <span className="text-sm font-semibold text-gray-900">
          멤버 <span className="text-gray-400">{members.length}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="닫기"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sorted.map((m) => {
          const pr = presenceOf(m.presence);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpenMember(m.id)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-50"
            >
              <div className="relative">
                <Avatar url={m.avatar_url} name={m.name} size={36} />
                <span className="absolute -bottom-0.5 -right-0.5">
                  <PresenceDot presence={m.presence} size={11} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">
                  {m.name}
                </div>
                <div className={`truncate text-[11px] ${pr.text}`}>
                  {m.position || pr.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
