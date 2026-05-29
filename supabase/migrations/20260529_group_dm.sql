-- 단체 DM 방
create table group_dm_rooms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  name text, -- 방 이름 (null이면 멤버 이름으로 표시)
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now()
);

-- 단체 DM 멤버
create table group_dm_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references group_dm_rooms(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  joined_at timestamptz default now(),
  last_read_at timestamptz default now(),
  unique(room_id, user_id)
);

-- 단체 DM 메시지
create table group_dm_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references group_dm_rooms(id) on delete cascade not null,
  sender_id uuid references profiles(id) not null,
  content text not null,
  sender_language text default 'ko',
  created_at timestamptz default now()
);

-- 단체 DM 번역 캐시
create table group_dm_translations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references group_dm_messages(id) on delete cascade not null,
  target_language text not null,
  translated_content text not null,
  created_at timestamptz default now(),
  unique(message_id, target_language)
);

-- 인덱스
create index idx_gdm_members_room on group_dm_members (room_id);
create index idx_gdm_members_user on group_dm_members (user_id);
create index idx_gdm_messages_room on group_dm_messages (room_id, created_at desc);
create index idx_gdm_translations_lookup on group_dm_translations (message_id, target_language);

-- RLS
alter table group_dm_rooms enable row level security;
alter table group_dm_members enable row level security;
alter table group_dm_messages enable row level security;
alter table group_dm_translations enable row level security;

-- 방 조회: 내가 멤버인 방만
create policy "gdm_rooms_select" on group_dm_rooms for select using (
  exists (
    select 1 from group_dm_members gm where gm.room_id = id and gm.user_id = auth.uid()
  )
);

-- 방 생성: 같은 회사 소속
create policy "gdm_rooms_insert" on group_dm_rooms for insert with check (
  auth.uid() = created_by
);

-- 멤버 조회: 내가 속한 방의 멤버
create policy "gdm_members_select" on group_dm_members for select using (
  exists (
    select 1 from group_dm_members gm where gm.room_id = group_dm_members.room_id and gm.user_id = auth.uid()
  )
);

-- 멤버 추가: 방 생성자만
create policy "gdm_members_insert" on group_dm_members for insert with check (
  exists (
    select 1 from group_dm_rooms r where r.id = room_id and r.created_by = auth.uid()
  ) or user_id = auth.uid()
);

-- 멤버 업데이트: 본인만 (last_read_at)
create policy "gdm_members_update" on group_dm_members for update using (
  user_id = auth.uid()
);

-- 메시지 조회: 내가 멤버인 방의 메시지
create policy "gdm_messages_select" on group_dm_messages for select using (
  exists (
    select 1 from group_dm_members gm where gm.room_id = group_dm_messages.room_id and gm.user_id = auth.uid()
  )
);

-- 메시지 전송: 내가 멤버인 방에만
create policy "gdm_messages_insert" on group_dm_messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from group_dm_members gm where gm.room_id = group_dm_messages.room_id and gm.user_id = auth.uid()
  )
);

-- 번역 조회
create policy "gdm_translations_select" on group_dm_translations for select using (
  exists (
    select 1 from group_dm_messages gm
    join group_dm_members gmem on gmem.room_id = gm.room_id
    where gm.id = group_dm_translations.message_id and gmem.user_id = auth.uid()
  )
);

-- Realtime 활성화
alter publication supabase_realtime add table group_dm_messages;
alter publication supabase_realtime add table group_dm_members;
