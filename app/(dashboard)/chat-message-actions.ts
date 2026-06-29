"use server";

import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";

// 메시지 수정/삭제 + 첨부 업로드 (개인 DM · 단체 DM · 부서 채널 공용)

type Table =
  | "direct_messages"
  | "group_dm_messages"
  | "dept_channel_messages";

async function me() {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return null;
  return { userId: user.id, adminClient: createAdminClient() };
}

// 본인 메시지인지 확인 후 content 수정 (edited_at 갱신)
async function editIn(table: Table, messageId: string, content: string) {
  const m = await me();
  if (!m) return { error: "로그인이 필요합니다" };
  const text = content.trim();
  if (!text) return { error: "내용을 입력해주세요" };

  const { data: msg } = await m.adminClient
    .from(table)
    .select("sender_id")
    .eq("id", messageId)
    .single();
  if (!msg) return { error: "메시지를 찾을 수 없습니다" };
  if (msg.sender_id !== m.userId) return { error: "본인 메시지만 수정할 수 있습니다" };

  const { error } = await m.adminClient
    .from(table)
    .update({ content: text, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) return { error: "수정에 실패했습니다" };
  return { success: true };
}

// 본인 메시지인지 확인 후 soft delete (deleted_at 기록, 내용 비움)
async function deleteIn(table: Table, messageId: string) {
  const m = await me();
  if (!m) return { error: "로그인이 필요합니다" };

  const { data: msg } = await m.adminClient
    .from(table)
    .select("sender_id")
    .eq("id", messageId)
    .single();
  if (!msg) return { error: "메시지를 찾을 수 없습니다" };
  if (msg.sender_id !== m.userId) return { error: "본인 메시지만 삭제할 수 있습니다" };

  const { error } = await m.adminClient
    .from(table)
    .update({
      deleted_at: new Date().toISOString(),
      content: "",
      attachment_url: null,
      attachment_type: null,
      attachment_name: null,
      attachments: [],
    })
    .eq("id", messageId);
  if (error) return { error: "삭제에 실패했습니다" };
  return { success: true };
}

// ===== 개인 DM =====
export async function editDirectMessage(messageId: string, content: string) {
  return editIn("direct_messages", messageId, content);
}
export async function deleteDirectMessage(messageId: string) {
  return deleteIn("direct_messages", messageId);
}

// ===== 단체 DM =====
export async function editGroupMessage(messageId: string, content: string) {
  return editIn("group_dm_messages", messageId, content);
}
export async function deleteGroupMessage(messageId: string) {
  return deleteIn("group_dm_messages", messageId);
}

// ===== 부서 채널 =====
export async function editChannelMessage(messageId: string, content: string) {
  return editIn("dept_channel_messages", messageId, content);
}
export async function deleteChannelMessage(messageId: string) {
  return deleteIn("dept_channel_messages", messageId);
}

// ===== 첨부 업로드 =====
// 클라이언트가 File을 FormData로 보내면 Storage에 올리고 공개 URL을 돌려준다.
const MAX_BYTES = 50 * 1024 * 1024; // 50MB

export async function uploadChatAttachment(formData: FormData): Promise<{
  url?: string;
  type?: "image" | "video" | "file";
  name?: string;
  error?: string;
}> {
  const m = await me();
  if (!m) return { error: "로그인이 필요합니다" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "파일이 없습니다" };
  if (file.size > MAX_BYTES) return { error: "최대 50MB까지 첨부할 수 있습니다" };

  const mime = file.type || "";
  const type: "image" | "video" | "file" = mime.startsWith("image/")
    ? "image"
    : mime.startsWith("video/")
      ? "video"
      : "file";

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const filePath = `${m.userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await m.adminClient.storage
    .from("chat-attachments")
    .upload(filePath, file, { upsert: false, contentType: mime || undefined });

  if (uploadError) return { error: "업로드에 실패했습니다" };

  const { data: urlData } = m.adminClient.storage
    .from("chat-attachments")
    .getPublicUrl(filePath);

  return { url: urlData.publicUrl, type, name: file.name };
}
