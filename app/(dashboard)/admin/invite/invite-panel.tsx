"use client";

import { useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { superAdminBulkInvite, type InviteResult } from "./actions";

interface CompanyOption {
  id: string;
  name: string;
  memberCount: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OUTCOME_META: Record<
  InviteResult["outcome"],
  { label: string; className: string }
> = {
  added: { label: "추가됨", className: "bg-green-50 text-green-600" },
  already_invited: { label: "이미 초대됨", className: "bg-gray-100 text-gray-500" },
  already_member: { label: "이미 멤버", className: "bg-gray-100 text-gray-500" },
  invalid: { label: "형식 오류", className: "bg-amber-50 text-amber-600" },
  error: { label: "실패", className: "bg-red-50 text-red-500" },
};

export default function InvitePanel({ companies }: { companies: CompanyOption[] }) {
  const [companyId, setCompanyId] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCompany = companies.find((c) => c.id === companyId);

  // 토큰(콤마/공백/줄바꿈/세미콜론 구분)을 칩으로 확정. 이미 있는 건 무시.
  function commitTokens(text: string) {
    const tokens = text
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length === 0) return;
    setEmails((prev) => {
      const seen = new Set(prev);
      const next = [...prev];
      for (const tk of tokens) {
        if (!seen.has(tk)) {
          seen.add(tk);
          next.push(tk);
        }
      }
      return next;
    });
    setResults(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === " " || e.key === "Tab") {
      if (input.trim()) {
        e.preventDefault();
        commitTokens(input);
        setInput("");
      } else if (e.key === "Enter") {
        e.preventDefault();
      }
    } else if (e.key === "Backspace" && !input && emails.length > 0) {
      // 빈 입력에서 Backspace → 마지막 칩 삭제
      setEmails((prev) => prev.slice(0, -1));
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (/[\s,;]/.test(text)) {
      e.preventDefault();
      commitTokens((input ? input + " " : "") + text);
      setInput("");
    }
  }

  function removeAt(i: number) {
    setEmails((prev) => prev.filter((_, idx) => idx !== i));
    inputRef.current?.focus();
  }

  async function handleSubmit() {
    if (!companyId) {
      toast.error("워크스페이스를 선택해주세요");
      return;
    }
    // 아직 확정 안 된 입력값도 포함
    const pending = input
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const all = Array.from(new Set([...emails, ...pending]));
    if (all.length === 0) {
      toast.error("이메일을 입력해주세요");
      return;
    }

    setLoading(true);
    setResults(null);
    const res = await superAdminBulkInvite(companyId, all);
    setLoading(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    const list = res.results ?? [];
    setResults(list);
    const added = list.filter((r) => r.outcome === "added").length;
    if (added > 0) {
      toast.success(`${selectedCompany?.name ?? "워크스페이스"}에 ${added}명 추가됨`);
      setEmails([]);
      setInput("");
    } else {
      toast.info("새로 추가된 이메일이 없습니다");
    }
  }

  return (
    <div className="rounded-xl bg-white p-6">
      <div className="space-y-5">
        {/* 워크스페이스 선택 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-900">워크스페이스</label>
          <Select
            value={companyId}
            onChange={(v) => {
              setCompanyId(v);
              setResults(null);
            }}
            placeholder="회사를 선택하세요"
            options={companies.map((c) => ({
              value: c.id,
              label: (
                <span className="flex items-center justify-between gap-3">
                  <span>{c.name}</span>
                  <span className="text-xs text-gray-400">{c.memberCount}명</span>
                </span>
              ),
            }))}
            className="w-full max-w-md"
          />
        </div>

        {/* 이메일 칩 입력 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-900">
            이메일
            {emails.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-gray-400">{emails.length}개</span>
            )}
          </label>
          <div
            onClick={() => inputRef.current?.focus()}
            className="flex min-h-[92px] w-full cursor-text flex-wrap content-start gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus-within:border-blue-500"
          >
            {emails.map((email, i) => {
              const valid = EMAIL_RE.test(email);
              return (
                <span
                  key={email}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] ${
                    valid ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {email}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAt(i);
                    }}
                    className={`ml-0.5 rounded-full p-0.5 transition-colors ${
                      valid ? "hover:bg-blue-100" : "hover:bg-amber-100"
                    }`}
                    aria-label={`${email} 삭제`}
                  >
                    <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none">
                      <path
                        d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </span>
              );
            })}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onBlur={() => {
                if (input.trim()) {
                  commitTokens(input);
                  setInput("");
                }
              }}
              placeholder={emails.length === 0 ? "이메일 입력 후 Enter (여러 개 붙여넣기 가능)" : ""}
              className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            초대 메일은 발송되지 않습니다. 대상자가 처음 로그인하면 이 워크스페이스로 자동
            합류합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "추가 중…" : "워크스페이스에 추가"}
        </button>
      </div>

      {/* 결과 */}
      {results && results.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-5">
          <h3 className="mb-3 text-sm font-medium text-gray-900">결과</h3>
          <ul className="divide-y divide-gray-50">
            {results.map((r) => {
              const meta = OUTCOME_META[r.outcome];
              return (
                <li key={r.email} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-gray-700">{r.email}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
