"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { superAdminBulkInvite, type InviteResult } from "./actions";

interface CompanyOption {
  id: string;
  name: string;
  memberCount: number;
}

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
  const [emailsText, setEmailsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);

  const selectedCompany = companies.find((c) => c.id === companyId);

  // 콤마/줄바꿈/공백/세미콜론 구분
  const parsedEmails = emailsText
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  async function handleSubmit() {
    if (!companyId) {
      toast.error("워크스페이스를 선택해주세요");
      return;
    }
    if (parsedEmails.length === 0) {
      toast.error("이메일을 입력해주세요");
      return;
    }

    setLoading(true);
    setResults(null);
    const res = await superAdminBulkInvite(companyId, parsedEmails);
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
      setEmailsText("");
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

        {/* 이메일 입력 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-900">
            이메일
            {parsedEmails.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-gray-400">
                {parsedEmails.length}개
              </span>
            )}
          </label>
          <textarea
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            placeholder={"여러 명은 줄바꿈 또는 콤마로 구분\n예) a@company.com, b@company.com"}
            rows={5}
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
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
