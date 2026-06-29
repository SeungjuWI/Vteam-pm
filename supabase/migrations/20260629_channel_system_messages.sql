-- 채널 시스템 메시지(멤버 입장 등) 지원
-- message_type: 'message'(일반) | 'member_joined'(멤버 입장 안내)
alter table dept_channel_messages
  add column if not exists message_type text not null default 'message';

-- 시스템 메시지 sender_id는 '입장한 멤버'를 가리킨다 (이름/아바타 합성용)
