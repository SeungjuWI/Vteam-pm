-- 봇 지원을 위한 프로필 확장
alter table profiles add column if not exists is_bot boolean default false;

-- 봇 프로필은 항상 online
-- RLS: 봇이 보낸 메시지도 수신자가 읽을 수 있도록 기존 정책 유지 (sender_id/receiver_id 기반)
