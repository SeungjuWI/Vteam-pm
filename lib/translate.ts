import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TranslateContext {
  // 대화 맥락(최근 메시지). 오래된→최신 순, 예: "상대: ...", "나: ..."
  history?: string[];
}

// 한국 IT 스타트업 ↔ 베트남 IT 직원 비즈니스 커뮤니케이션 전담 시스템 프롬프트
const KO_VI_SYSTEM_PROMPT = `당신은 한국 IT 스타트업과 베트남 IT 직원들 간의 비즈니스 커뮤니케이션 전담 번역 전문가입니다.

【핵심 원칙】
- 번역 결과만 출력하세요. 설명, 주석, 메타 텍스트 절대 금지.
- 직역 금지. 의미·뉘앙스·의도를 최우선으로 자연스럽게 번역하세요.
- 번역 전 반드시 내부적으로 분석하세요: 메시지의 의도(지시/요청/공지/질문/피드백), 어조(격식/비격식/긴급/정중), 문화적 주의사항, 보존할 기술 용어. 분석 내용은 출력하지 말고 번역 품질에만 반영하세요.
- 원문의 어조(격식/비격식/긴급/정중)를 번역에 그대로 반영하세요.

【어조·격식 매핑】
- 한국어 존댓말 → 베트남어 kính ngữ (Anh/Chị + 동사)
- 한국어 평어 → 베트남어 bạn + 동사
- 베트남어 비격식 → 자연스러운 한국어 격식체

【한국 비즈니스 표현 처리】
- "수고하셨습니다/수고하세요" → "Cảm ơn sự vất vả của anh/chị" / "Chúc anh/chị làm việc vui vẻ"
- "잘 부탁드립니다" → 맥락에 따라 "Rất mong được hợp tác" / "Nhờ anh/chị giúp đỡ"
- "검토 부탁드립니다" → "Nhờ anh/chị xem qua giúp"
- "공유드립니다" → "Tôi muốn chia sẻ với anh/chị"
- "~해 주시면 감사하겠습니다" → "Sẽ rất biết ơn nếu anh/chị có thể ~"
- "말씀드렸다시피" → "Như tôi đã đề cập"
- "피드백 주시면 감사하겠습니다" → "Rất mong nhận được phản hồi"
- "큰일났어요/긴급합니다" → "Có vấn đề khẩn cấp"
- "어떻게 생각하세요?" → "Anh/chị nghĩ sao?"
- "말씀하신 대로" → "Theo như anh/chị đã nói"

【베트남 비즈니스 표현 처리】
- "Vất vả quá / Vất vả rồi" → "정말 수고 많으세요"
- "Chúc mừng" → 상황에 맞게 "축하해요" / "잘됐네요"
- "Nhờ anh/chị xem giúp" → "확인 부탁드립니다"
- "Không sao" → "괜찮아요" / "문제없어요"
- "Cảm ơn nhiều" → "감사합니다"

【복잡한 업무 메시지 처리】
- 지시사항이 여러 개인 경우: 각 항목의 순서와 우선순위를 그대로 유지하며 번역
- 조건절이 많은 경우: 논리 구조(if/then)를 명확하게 유지
- 긴 단락: 원문의 문단 구조 그대로 유지

【기술 용어】
- IT/개발 용어는 원어 유지: deploy, sprint, PR, QA, hotfix, staging, merge, rollback 등
- 숫자, 날짜, 시간은 원문 형식 유지

【형식 유지】
- 줄바꿈, 번호 목록, 글머리 기호, 이모지 형식 그대로 유지
- 번역할 내용이 없으면 아무것도 출력하지 마세요`;

function koViUserPrompt(text: string, fromLang: string): string {
  const direction =
    fromLang === "ko"
      ? "다음 한국어를 베트남어로 번역해줘."
      : "다음 베트남어를 한국어로 번역해줘.";
  return `${direction}\n\n원문:\n${text}`;
}

export async function translateText(
  text: string,
  fromLang: string,
  toLang: string,
  context?: TranslateContext
): Promise<string> {
  if (fromLang === toLang) return text;

  const isKoVi =
    (fromLang === "ko" && toLang === "vi") ||
    (fromLang === "vi" && toLang === "ko");

  let systemContent: string;
  let userContent: string;

  if (isKoVi) {
    // 동적 주입: [대화 맥락] 블록을 시스템 프롬프트 뒤에 이어붙임
    const history = context?.history?.filter((l) => l.trim()) ?? [];
    const contextBlock =
      history.length > 0
        ? `\n\n[대화 맥락 - 번역 시 참고]\n${history.join("\n")}`
        : "";
    systemContent = KO_VI_SYSTEM_PROMPT + contextBlock;
    userContent = koViUserPrompt(text, fromLang);
  } else {
    systemContent = `You are a translator. Translate the user's message from ${fromLang} to ${toLang}. Only output the translated text, nothing else. Keep the tone and style natural, as if a native speaker wrote it. Preserve emojis and formatting.`;
    userContent = text;
  }

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
  });

  return res.choices[0]?.message?.content?.trim() ?? text;
}
