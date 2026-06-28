"use server";

import { createClient } from "@/lib/supabase/server";
import { getClaimsUser } from "@/lib/supabase/auth-cache";
import { createAdminClient } from "@/lib/supabase/admin";

const EPOCH = "1970-01-01T00:00:00Z";

async function ctx() {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;
  return { userId: user.id, companyId: profile.company_id, adminClient };
}

// 전역 알림 훅이 메시지를 라우팅하는 데 필요한 컨텍스트
//  - names:      sender_id → 표시 이름 (회사 전체 + 봇)
//  - roomIds:    내가 속한 단체 DM 방 id 목록
//  - channelIds: 내가 속한 부서 채널 id 목록
export async function getChatNotifyContext(): Promise<{
  names: Record<string, string>;
  roomIds: string[];
  channelIds: string[];
}> {
  const c = await ctx();
  if (!c) return { names: {}, roomIds: [], channelIds: [] };
  const { userId, companyId, adminClient } = c;

  const { data: members } = await adminClient
    .from("profiles")
    .select("id, name")
    .eq("company_id", companyId);
  const names: Record<string, string> = {};
  for (const m of members ?? []) names[m.id] = m.name;

  const { data: myRooms } = await adminClient
    .from("group_dm_members")
    .select("room_id")
    .eq("user_id", userId);
  const roomIds = [...new Set((myRooms ?? []).map((r) => r.room_id))];

  const { data: myDepts } = await adminClient
    .from("department_members")
    .select("department_id")
    .eq("user_id", userId);
  const deptIds = [...new Set((myDepts ?? []).map((m) => m.department_id))];

  let channelIds: string[] = [];
  if (deptIds.length) {
    const { data: channels } = await adminClient
      .from("dept_channels")
      .select("id")
      .in("department_id", deptIds);
    channelIds = (channels ?? []).map((ch) => ch.id);
  }

  return { names, roomIds, channelIds };
}

// 탭 타이틀 (N) 뱃지용 전체 미읽음 합계 (DM + 단체 DM + 부서 채널)
export async function getTotalChatUnread(): Promise<number> {
  const c = await ctx();
  if (!c) return 0;
  const { userId, adminClient } = c;

  // 1) DM
  const { count: dmCount } = await adminClient
    .from("direct_messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("is_read", false);

  // 2) 단체 DM (last_read_at 이후, 내가 보낸 것 제외)
  const { data: myRooms } = await adminClient
    .from("group_dm_members")
    .select("room_id, last_read_at")
    .eq("user_id", userId);

  let groupCount = 0;
  for (const r of myRooms ?? []) {
    const { count } = await adminClient
      .from("group_dm_messages")
      .select("id", { count: "exact", head: true })
      .eq("room_id", r.room_id)
      .neq("sender_id", userId)
      .gt("created_at", r.last_read_at ?? EPOCH);
    groupCount += count ?? 0;
  }

  // 3) 부서 채널 (dept_channel_reads.last_read_at 이후, 내가 보낸 것 제외)
  const { data: myDepts } = await adminClient
    .from("department_members")
    .select("department_id")
    .eq("user_id", userId);
  const deptIds = [...new Set((myDepts ?? []).map((m) => m.department_id))];

  let channelCount = 0;
  if (deptIds.length) {
    const { data: channels } = await adminClient
      .from("dept_channels")
      .select("id")
      .in("department_id", deptIds);
    const channelIds = (channels ?? []).map((ch) => ch.id);

    if (channelIds.length) {
      const { data: reads } = await adminClient
        .from("dept_channel_reads")
        .select("channel_id, last_read_at")
        .eq("user_id", userId)
        .in("channel_id", channelIds);
      const readMap = new Map(
        (reads ?? []).map((r) => [r.channel_id, r.last_read_at])
      );

      for (const cid of channelIds) {
        const lastRead = readMap.get(cid);
        let q = adminClient
          .from("dept_channel_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", cid)
          .neq("sender_id", userId);
        if (lastRead) q = q.gt("created_at", lastRead);
        const { count } = await q;
        channelCount += count ?? 0;
      }
    }
  }

  return (dmCount ?? 0) + groupCount + channelCount;
}
