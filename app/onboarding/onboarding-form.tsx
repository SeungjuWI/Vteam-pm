"use client";

import Image from "next/image";
import { useState } from "react";
import { createCompany } from "./actions";
import LanguageSelect from "@/components/language-select";

export default function OnboardingForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    const result = await createCompany(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="vtm" width={36} height={36} />
          <h1 className="text-xl font-bold text-gray-900">회사 등록</h1>
          <p className="text-sm text-gray-500">관리자로 시작합니다. 회사 정보를 입력해주세요.</p>
        </div>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">이름</label>
            <input
              type="text"
              name="name"
              placeholder="이름을 입력하세요"
              maxLength={20}
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">회사명</label>
            <input
              type="text"
              name="companyName"
              placeholder="회사명을 입력하세요"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">모국어</label>
            <LanguageSelect />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "생성 중..." : "시작하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
