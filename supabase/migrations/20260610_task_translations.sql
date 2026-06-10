-- 태스크 내용 자동 번역 캐시 (DM 메시지 번역과 동일 패턴)
-- 작성자 언어 저장(번역 출발어), 보는 사람 언어로 1회 번역 후 캐시 재사용
alter table tasks add column if not exists source_language text default 'ko';

create table if not exists task_translations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  field text not null,            -- 'title' | 'description'
  target_language text not null,
  translated_text text not null,
  created_at timestamptz default now(),
  unique(task_id, field, target_language)
);
create index if not exists idx_task_translations_lookup on task_translations(task_id, target_language);
