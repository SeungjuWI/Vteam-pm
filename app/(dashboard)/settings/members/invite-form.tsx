"use client";

import { useRef, useState } from "react";
import { inviteMember } from "./actions";
import { useT } from "@/lib/i18n";

export default function InviteForm() {
  const t = useT();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    setSuccess(false);
    const result = await inviteMember(formData);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(true);
      formRef.current?.reset();
      setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl bg-white p-6">
      <h2 className="mb-4 text-sm font-medium text-gray-900">{t("members.invite")}</h2>
      <form ref={formRef} action={handleSubmit} className="flex gap-3">
        <input
          type="email"
          name="email"
          placeholder={t("members.invitePlaceholder")}
          className="flex-1 rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-bold text-white shadow-soft-sm transition-all duration-200 ease-spring hover:bg-blue-600 hover:shadow-brand active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? t("members.inviting") : t("members.inviteSubmit")}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {success && <p className="mt-2 text-sm text-blue-500">{t("members.inviteSuccess")}</p>}
    </div>
  );
}
