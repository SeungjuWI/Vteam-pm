// 현재 사용자가 "보고 있는" 대화창 키를 추적하는 전역 레지스트리.
// 전역 알림 훅(use-global-chat-notifications)이 메시지 도착 시
// 해당 대화를 이미 보고 있는지 판단해 소리 중복을 막는 용도.
//
// 키 형식:
//   DM        → `dm-${상대userId}`
//   단체 DM   → `group-${roomId}`
//   부서 채널 → `channel-${channelId}`

const activeKeys = new Set<string>();

export function setChatActive(key: string, active: boolean) {
  if (active) activeKeys.add(key);
  else activeKeys.delete(key);
}

export function isChatActive(key: string) {
  return activeKeys.has(key);
}
