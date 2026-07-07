"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSuperAdmin } from "@/lib/auth/super-admin";

export type InviteOutcome = "added" | "already_invited" | "already_member" | "invalid" | "error";

export interface InviteResult {
  email: string;
  outcome: InviteOutcome;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 운영자(슈퍼어드민) 전용 — 특정 워크스페이스(company)에 이메일을 직접 꽂는다.
 * 초대 메일 발송 없이 invitations 에 pending 레코드만 생성한다. 대상자가 처음
 * 구글 로그인하는 순간 auth/callback 이 이 레코드를 보고 해당 회사로 자동 합류시킨다.
 * 이미 로그인 이력이 있는(auth 계정 존재) 이메일은 대상이 아니다.
 */
export async function superAdminBulkInvite(
  companyId: string,
  rawEmails: string[]
): Promise<{ error?: string; results?: InviteResult[] }> {
  const operator = await getSuperAdmin();
  if (!operator) return { error: "운영자 권한이 없습니다" };

  if (!companyId) return { error: "워크스페이스를 선택해주세요" };

  const adminClient = createAdminClient();

  // 회사 존재 확인
  const { data: company } = await adminClient
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .single();
  if (!company) return { error: "존재하지 않는 워크스페이스입니다" };

  // 정규화 + 중복 제거
  const emails = Array.from(
    new Set(rawEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  );
  if (emails.length === 0) return { error: "이메일을 입력해주세요" };

  const results: InviteResult[] = [];

  for (const email of emails) {
    if (!EMAIL_RE.test(email)) {
      results.push({ email, outcome: "invalid" });
      continue;
    }

    // 이미 이 회사에 pending 초대가 있는지
    const { data: existingInvite } = await adminClient
      .from("invitations")
      .select("id")
      .eq("email", email)
      .eq("company_id", companyId)
      .eq("status", "pending")
      .maybeSingle();
    if (existingInvite) {
      results.push({ email, outcome: "already_invited" });
      continue;
    }

    // 이미 이 회사 멤버인지
    const { data: existingMember } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .eq("company_id", companyId)
      .maybeSingle();
    if (existingMember) {
      results.push({ email, outcome: "already_member" });
      continue;
    }

    const { error: insertError } = await adminClient.from("invitations").insert({
      company_id: companyId,
      email,
      invited_by: operator.id,
    });

    results.push({ email, outcome: insertError ? "error" : "added" });
  }

  return { results };
}
