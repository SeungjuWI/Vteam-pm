-- 태스크 세부 할일 체크리스트: [{ id, text, done }] 배열
alter table tasks add column if not exists checklist jsonb default '[]'::jsonb;
