-- 태스크 댓글 이미지/파일 첨부 (슬랙식: 한 댓글에 여러 이미지)
-- 대상: task_comments
--
-- ⚠️ 마이그레이션은 자동 적용되지 않음 → 배포 전 프로덕션 Supabase SQL 에디터에 직접 실행할 것.
-- (안 하면 getTaskComments가 attachments 컬럼을 select하다 실패 → 댓글이 로드되지 않음)
--
-- 각 배열 원소 형태: { "url": text, "type": "image"|"video"|"file", "name": text }
-- 스토리지는 채팅과 동일한 chat-attachments 버킷을 재사용한다.

alter table task_comments
  add column if not exists attachments jsonb not null default '[]'::jsonb;
