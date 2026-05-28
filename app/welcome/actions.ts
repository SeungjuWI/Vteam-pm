"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveWelcomeProfile(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "이름을 입력해주세요" };

  const position = (formData.get("position") as string)?.trim() || null;
  const joinDate = (formData.get("joinDate") as string) || null;
  const language = (formData.get("language") as string) || "ko";

  // 아바타 업로드
  let avatarUrl: string | null = null;
  const avatarFile = formData.get("avatar") as File | null;

  if (avatarFile && avatarFile.size > 0) {
    if (avatarFile.size > 2 * 1024 * 1024) {
      return { error: "프로필 사진은 2MB 이하만 가능합니다" };
    }

    const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await adminClient.storage
      .from("avatars")
      .upload(filePath, avatarFile, { upsert: true });

    if (uploadError) return { error: "사진 업로드에 실패했습니다" };

    const { data: urlData } = adminClient.storage
      .from("avatars")
      .getPublicUrl(filePath);

    avatarUrl = urlData.publicUrl;
  }

  const payload: Record<string, unknown> = {
    name,
    position,
    join_date: joinDate,
    language,
    status: "active",
  };
  if (avatarUrl) {
    payload.avatar_url = avatarUrl;
  }

  const { error } = await adminClient
    .from("profiles")
    .update(payload)
    .eq("id", user.id);

  if (error) return { error: "저장에 실패했습니다" };

  // 초대 완료 처리
  await adminClient
    .from("invitations")
    .update({ status: "accepted" })
    .eq("email", user.email!.toLowerCase())
    .in("status", ["pending", "accepted"]);

  redirect("/attendance");
}
