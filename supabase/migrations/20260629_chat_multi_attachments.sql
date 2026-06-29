-- 채팅 메시지 다중 첨부 (슬랙식: 한 메시지에 여러 이미지/영상/파일)
-- 대상: 개인 DM(direct_messages), 단체 DM(group_dm_messages), 부서 채널(dept_channel_messages)
--
-- ⚠️ 마이그레이션은 자동 적용되지 않음 → 배포 전 프로덕션 Supabase SQL 에디터에 직접 실행할 것.
--
-- 기존 단일 첨부 컬럼(attachment_url/type/name)은 하위호환을 위해 유지한다.
-- 신규 메시지는 attachments(jsonb 배열)에 저장하고, 첫 번째 항목을 레거시 컬럼에도 함께 기록한다.
-- 각 배열 원소 형태: { "url": text, "type": "image"|"video"|"file", "name": text }

alter table direct_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table group_dm_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table dept_channel_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;
