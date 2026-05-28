-- 메시지에 발신자 언어 추가
alter table direct_messages
  add column if not exists sender_language text default 'ko';

-- 번역 캐시 테이블
create table message_translations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references direct_messages(id) on delete cascade not null,
  target_language text not null,
  translated_content text not null,
  created_at timestamptz default now(),
  unique(message_id, target_language)
);

create index idx_translations_lookup on message_translations (message_id, target_language);

-- RLS
alter table message_translations enable row level security;

create policy "translation_select" on message_translations for select using (
  exists (
    select 1 from direct_messages dm
    where dm.id = message_translations.message_id
    and (auth.uid() = dm.sender_id or auth.uid() = dm.receiver_id)
  )
);
