"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "이름은 필수입니다" };

  const position = (formData.get("position") as string)?.trim() || null;

  // 아바타 업로드
  let avatarUrl: string | null | undefined;
  const avatarFile = formData.get("avatar") as File | null;
  const removeAvatar = formData.get("removeAvatar");

  if (avatarFile && avatarFile.size > 0) {
    if (avatarFile.size > 2 * 1024 * 1024) {
      return { error: "프로필 사진은 2MB 이하만 가능합니다" };
    }

    const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `${user.id}/avatar.${ext}`;

    const { data: existing } = await adminClient.storage
      .from("avatars")
      .list(user.id);
    if (existing && existing.length > 0) {
      await adminClient.storage
        .from("avatars")
        .remove(existing.map((f) => `${user.id}/${f.name}`));
    }

    const { error: uploadError } = await adminClient.storage
      .from("avatars")
      .upload(filePath, avatarFile, { upsert: true });

    if (uploadError) return { error: "사진 업로드에 실패했습니다" };

    const { data: urlData } = adminClient.storage
      .from("avatars")
      .getPublicUrl(filePath);

    avatarUrl = urlData.publicUrl;
  } else if (removeAvatar === "true") {
    const { data: existing } = await adminClient.storage
      .from("avatars")
      .list(user.id);
    if (existing && existing.length > 0) {
      await adminClient.storage
        .from("avatars")
        .remove(existing.map((f) => `${user.id}/${f.name}`));
    }
    avatarUrl = null;
  }

  const payload: Record<string, unknown> = { name, position };
  if (avatarUrl !== undefined) {
    payload.avatar_url = avatarUrl;
  }

  const { error } = await adminClient
    .from("profiles")
    .update(payload)
    .eq("id", user.id);

  if (error) return { error: "저장에 실패했습니다" };

  revalidatePath("/settings");
  revalidatePath("/members");
  return { success: true };
}
