// 출퇴근 IP 제한 상태 판정. clockIn/clockOut 액션과 출퇴근 페이지(배너 표시)가 공유한다.
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientIp, ipMatchesAny } from "./ip";

export type ClockIpState = {
  restricted: boolean; // 이 유저에게 IP 제한이 걸려 있는지
  allowed: boolean; // 현재 요청 IP로 출퇴근 가능한지
  ip: string | null; // 감지된 현재 IP (안내/디버깅용)
};

// 정책 없음(null) / 정책 삭제됨 / 허용 목록 비어 있음 → 제한 없음(허용)으로 본다.
export async function getClockIpState(
  adminClient: SupabaseClient,
  ipPolicyId: string | null,
): Promise<ClockIpState> {
  const ip = getClientIp(await headers());
  if (!ipPolicyId) return { restricted: false, allowed: true, ip };

  const { data: policy } = await adminClient
    .from("ip_policies")
    .select("cidrs")
    .eq("id", ipPolicyId)
    .single();

  const cidrs: string[] = policy?.cidrs ?? [];
  if (cidrs.length === 0) return { restricted: false, allowed: true, ip };

  return { restricted: true, allowed: ip ? ipMatchesAny(ip, cidrs) : false, ip };
}
