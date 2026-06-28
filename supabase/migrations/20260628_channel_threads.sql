-- 부서 채널 스레드(답글) 기능 — 슬랙식 메시지 내 댓글
-- 대상: 부서 채널(dept_channel_messages)
--
-- ⚠️ 마이그레이션은 자동 적용되지 않음 → 배포 전 프로덕션 Supabase SQL 에디터에 직접 실행할 것.

-- 1) 스레드 루트 참조 컬럼 추가 -------------------------------------------------
--    thread_root_id가 NULL이면 채널 본문 메시지, 값이 있으면 해당 메시지의 답글.
alter table dept_channel_messages
  add column if not exists thread_root_id uuid
    references dept_channel_messages(id) on delete cascade;

-- 2) 답글 조회 인덱스 (스레드별 답글 모으기 / 답글 수 카운트) --------------------
create index if not exists idx_dept_channel_messages_thread_root
  on dept_channel_messages(thread_root_id);
