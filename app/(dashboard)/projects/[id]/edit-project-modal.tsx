"use client";

import { useRef, useState } from "react";
import { updateProject } from "../actions";
import { compressImage } from "@/lib/compress-image";
import { useT } from "@/lib/i18n";
import type { Project } from "./project-types";

export default function EditProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(project.imageUrl);
  const [removeImage, setRemoveImage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const compressedRef = useRef<File | null>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { blob, dataUrl } = await compressImage(file, 1200);
      compressedRef.current = new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: blob.type });
      setPreview(dataUrl);
      setRemoveImage(false);
    } catch {
      setError(t("common.imageLoadFailed"));
    }
  }

  function handleRemoveImage() {
    setPreview(null);
    setRemoveImage(true);
    compressedRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    formData.set("projectId", project.id);
    if (compressedRef.current) formData.set("image", compressedRef.current);
    if (removeImage) formData.set("removeImage", "true");
    const result = await updateProject(formData);
    if (result?.error) { setError(result.error); setLoading(false); }
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{t("editProject.title")}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("createProject.image")}</label>
            {preview ? (
              <div className="relative inline-block">
                <img src={preview} alt="" className="h-20 w-20 rounded-xl object-cover" />
                <button type="button" onClick={handleRemoveImage} className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-gray-300 text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-500">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
              </button>
            )}
            <input ref={fileRef} type="file" name="image" accept="image/*" onChange={handleImageChange} className="hidden" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("createProject.name")} <span className="text-red-400">*</span></label>
            <input type="text" name="name" defaultValue={project.name} required className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">{t("createProject.description")}</label>
            <textarea name="description" defaultValue={project.description || ""} rows={3} className="w-full resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">{t("common.cancel")}</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50">{loading ? t("common.saving") : t("common.save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
