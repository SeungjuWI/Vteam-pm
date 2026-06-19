import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyOverdue, buildDigestText, postToSlack } from "@/lib/slack";

// Vercel 크론(vercel.json)이 매일 평일 오전 10시(KST)에 호출.
// 슬랙 알림을 켠 회사들의 지연 업무를 모아 각 회사 채널로 전송한다.
export async function GET(req: NextRequest) {
  // 크론/운영자만 호출 가능하도록 CRON_SECRET 검증
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  const { data: companies } = await adminClient
    .from("companies")
    .select("id, name, slack_webhook_url")
    .eq("slack_digest_enabled", true)
    .not("slack_webhook_url", "is", null);

  const results: { company: string; overdue: number; sent: boolean }[] = [];

  for (const c of companies ?? []) {
    const webhook = (c.slack_webhook_url as string)?.trim();
    if (!webhook) continue;

    const items = await getCompanyOverdue(adminClient, c.id);
    if (items.length === 0) {
      // 지연 업무가 없으면 스팸 방지를 위해 보내지 않음
      results.push({ company: c.name, overdue: 0, sent: false });
      continue;
    }

    const text = buildDigestText(c.name, items);
    const sent = await postToSlack(webhook, text);
    results.push({ company: c.name, overdue: items.length, sent });
  }

  return NextResponse.json({ ok: true, ran: results.length, results });
}
