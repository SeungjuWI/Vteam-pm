"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveCompanyInfo } from "./actions";
import { compressImage } from "@/lib/compress-image";
import { useT } from "@/lib/i18n";

interface CompanyData {
  name: string;
  foundedAt: string;
  businessNumber: string;
  corpNumber: string;
  phone: string;
  address: string;
  logoUrl: string;
  createdAt: string;
  memberCount: number;
}

export default function CompanyInfoView({
  data,
  isEditable,
}: {
  data: CompanyData;
  isEditable: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const compressedLogoRef = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);

    if (compressedLogoRef.current) {
      formData.delete("logo");
      formData.set("logo", new File([compressedLogoRef.current], "logo.webp", { type: compressedLogoRef.current.type }));
    }

    const result = await saveCompanyInfo(formData);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: t("common.saved") });
      setEditing(false);
      setLogoPreview(null);
      setLogoRemoved(false);
      compressedLogoRef.current = null;
      router.refresh();
      setTimeout(() => setMessage(null), 2000);
    }
    setSaving(false);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: t("common.imageOnly") });
      return;
    }

    try {
      const { blob, dataUrl } = await compressImage(file, 200);
      compressedLogoRef.current = blob;
      setLogoPreview(dataUrl);
      setLogoRemoved(false);
    } catch {
      setMessage({ type: "error", text: t("common.imageFailed") });
    }
  }

  function handleLogoRemove() {
    setLogoPreview(null);
    setLogoRemoved(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const currentLogo = logoPreview || (logoRemoved ? "" : data.logoUrl);

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">{t("company.title")}</h2>
          <button
            type="button"
            onClick={() => { setEditing(false); setLogoPreview(null); setLogoRemoved(false); }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {t("common.cancel")}
          </button>
        </div>

        {/* 로고 업로드 */}
        <div className="mb-5 flex flex-col gap-1.5">
          <span className="text-sm text-gray-500">{t("company.logo")}</span>
          <div className="flex items-center gap-4">
            <div
              className="relative flex h-20 w-20 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-colors hover:bg-gray-100"
              onClick={() => fileInputRef.current?.click()}
            >
              {currentLogo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={currentLogo} alt={t("company.logo")} className="h-full w-full object-contain p-1" />
              ) : (
                <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-fit rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
              >
                {currentLogo ? t("common.change") : t("common.upload")}
              </button>
              {currentLogo && (
                <button
                  type="button"
                  onClick={handleLogoRemove}
                  className="w-fit text-xs text-gray-400 hover:text-red-400"
                >
                  {t("common.delete")}
                </button>
              )}
              <span className="text-[11px] text-gray-400">{t("company.logoSpec")}</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            name="logo"
            accept="image/*,.heic,.heif"
            onChange={handleLogoChange}
            className="hidden"
          />
          {logoRemoved && !logoPreview && (
            <input type="hidden" name="removeLogo" value="true" />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Field label={t("company.name")} name="name" defaultValue={data.name} required />
          <Field label={t("company.foundedAt")} name="foundedAt" type="date" defaultValue={data.foundedAt} />
          <Field label={t("company.businessNumber")} name="businessNumber" defaultValue={data.businessNumber} placeholder="01-1234-45678" />
          <Field label={t("company.corpNumber")} name="corpNumber" defaultValue={data.corpNumber} placeholder="11111111111" />
          <Field label={t("company.phone")} name="phone" defaultValue={data.phone} placeholder="02-1234-5678" />
          <Field label={t("company.address")} name="address" defaultValue={data.address} placeholder="서울특별시 강남구 테헤란로14길 13(역삼동)" />
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
          {message && (
            <span className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-500"}`}>
              {message.text}
            </span>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">{t("company.title")}</h2>
        {isEditable && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-500 hover:text-blue-600"
          >
            {t("common.edit")}
          </button>
        )}
      </div>

      {/* 로고 표시 */}
      {data.logoUrl && (
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.logoUrl} alt={t("company.logo")} className="h-full w-full object-contain p-1" />
          </div>
          <span className="text-sm font-medium text-gray-900">{data.name}</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <InfoRow label={t("company.name")} value={data.name} />
        <InfoRow label={t("company.totalMembers")} value={`${data.memberCount}`} />
        <InfoRow label={t("company.joinDate")} value={new Date(data.createdAt).toLocaleDateString(undefined)} />
        {data.foundedAt && <InfoRow label={t("company.foundedAt")} value={data.foundedAt} />}
        {data.businessNumber && <InfoRow label={t("company.businessNumber")} value={data.businessNumber} />}
        {data.corpNumber && <InfoRow label={t("company.corpNumber")} value={data.corpNumber} />}
        {data.phone && <InfoRow label={t("company.phone")} value={data.phone} />}
        {data.address && <InfoRow label={t("company.address")} value={data.address} />}
      </div>
      {message && (
        <p className={`mt-3 text-sm ${message.type === "success" ? "text-green-600" : "text-red-500"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm text-gray-500">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-blue-500"
      />
    </div>
  );
}
