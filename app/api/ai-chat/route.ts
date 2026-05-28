import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateBotResponse } from "@/lib/ai-chat";

export async function POST(req: NextRequest) {
  const { botId, userId, companyId, content } = await req.json();

  if (!botId || !userId || !companyId || !content) {
    return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // 사용자 프로필 확인
  const { data: userProfile } = await adminClient
    .from("profiles")
    .select("company_id, language")
    .eq("id", userId)
    .single();

  if (!userProfile || userProfile.company_id !== companyId) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  // 최근 대화 이력 가져오기 (컨텍스트용)
  const { data: history } = await adminClient
    .from("direct_messages")
    .select("sender_id, content")
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${botId}),and(sender_id.eq.${botId},receiver_id.eq.${userId})`
    )
    .order("created_at", { ascending: true })
    .limit(20);

  const conversationHistory = (history ?? []).map((m) => ({
    role: (m.sender_id === userId ? "user" : "assistant") as "user" | "assistant",
    content: m.content,
  }));

  // AI 응답 생성
  const botReply = await generateBotResponse(content, conversationHistory);

  // 봇 메시지를 DM으로 저장
  const { error } = await adminClient.from("direct_messages").insert({
    company_id: companyId,
    sender_id: botId,
    receiver_id: userId,
    content: botReply,
    sender_language: userProfile.language ?? "ko",
  });

  if (error) {
    return NextResponse.json({ error: "응답 저장 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true, reply: botReply });
}
