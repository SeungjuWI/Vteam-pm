-- 프로필에 프레즌스 필드 추가
alter table profiles
  add column if not exists presence text default 'offline'
    check (presence in ('online', 'away', 'offline')),
  add column if not exists last_seen_at timestamptz default now();

-- DM 메시지 테이블
create table direct_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  sender_id uuid references profiles(id) not null,
  receiver_id uuid references profiles(id) not null,
  content text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- 인덱스
create index idx_dm_participants on direct_messages (sender_id, receiver_id, created_at desc);
create index idx_dm_receiver_unread on direct_messages (receiver_id, is_read) where is_read = false;
create index idx_profiles_presence on profiles (company_id, presence);

-- DM 실시간 구독을 위한 RLS
alter table direct_messages enable row level security;

create policy "dm_select" on direct_messages for select using (
  auth.uid() = sender_id or auth.uid() = receiver_id
);

create policy "dm_insert" on direct_messages for insert with check (
  auth.uid() = sender_id
);

create policy "dm_update" on direct_messages for update using (
  auth.uid() = receiver_id
);

-- Realtime 활성화
alter publication supabase_realtime add table direct_messages;
