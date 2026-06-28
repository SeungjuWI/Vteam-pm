// 채팅 본문 마크업을 사람이 읽기 좋은 평문으로 변환.
// 멘션 @[이름](uid) → @이름, 굵게 **텍스트** → 텍스트
// 알림 메시지/브라우저 알림 본문처럼 스타일 없이 보여줄 때 사용.
export function stripChatMarkup(text: string): string {
  if (!text) return "";
  return text
    .replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1");
}

// 본문에서 멘션된 사용자 id 목록을 추출 (중복 제거).
export function extractMentionIds(text: string): string[] {
  if (!text) return [];
  const ids = new Set<string>();
  const re = /@\[[^\]]+\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) ids.add(m[1]);
  return [...ids];
}
