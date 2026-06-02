-- 부서 (Departments)
create table departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  name text not null,
  color text default '#3182F6', -- TDS 색상 토큰 값
  description text,
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now()
);

-- 부서 멤버 (N:M, 한 멤버가 여러 부서 가능)
create table department_members (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references departments(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(department_id, user_id)
);

-- 부서 채널 (부서 안의 여러 채널, 슬랙형)
create table dept_channels (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references departments(id) on delete cascade not null,
  name text not null,
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now()
);

-- 채널 메시지
create table dept_channel_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references dept_channels(id) on delete cascade not null,
  sender_id uuid references profiles(id) not null,
  content text not null,
  sender_language text default 'ko',
  created_at timestamptz default now()
);

-- 채널 메시지 번역 캐시
create table dept_channel_translations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references dept_channel_messages(id) on delete cascade not null,
  target_language text not null,
  translated_content text not null,
  created_at timestamptz default now(),
  unique(message_id, target_language)
);

-- 채널 읽음 추적 (안읽음 배지)
create table dept_channel_reads (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references dept_channels(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  last_read_at timestamptz default now(),
  unique(channel_id, user_id)
);

-- 인덱스
create index idx_departments_company on departments (company_id);
create index idx_dept_members_dept on department_members (department_id);
create index idx_dept_members_user on department_members (user_id);
create index idx_dept_channels_dept on dept_channels (department_id);
create index idx_dept_channel_messages_channel on dept_channel_messages (channel_id, created_at desc);
create index idx_dept_channel_translations_lookup on dept_channel_translations (message_id, target_language);
create index idx_dept_channel_reads_user on dept_channel_reads (user_id);

-- RLS
alter table departments enable row level security;
alter table department_members enable row level security;
alter table dept_channels enable row level security;
alter table dept_channel_messages enable row level security;
alter table dept_channel_translations enable row level security;
alter table dept_channel_reads enable row level security;

-- 부서 조회: 같은 회사 멤버
create policy "departments_select" on departments for select using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.company_id = departments.company_id
  )
);

-- 부서 멤버 조회: 내가 속한 부서의 멤버
create policy "dept_members_select" on department_members for select using (
  exists (
    select 1 from department_members dm
    where dm.department_id = department_members.department_id and dm.user_id = auth.uid()
  )
);

-- 채널 조회: 내가 그 부서 멤버일 때
create policy "dept_channels_select" on dept_channels for select using (
  exists (
    select 1 from department_members dm
    where dm.department_id = dept_channels.department_id and dm.user_id = auth.uid()
  )
);

-- 채널 메시지 조회: 내가 그 채널의 부서 멤버일 때
create policy "dept_channel_messages_select" on dept_channel_messages for select using (
  exists (
    select 1 from dept_channels c
    join department_members dm on dm.department_id = c.department_id
    where c.id = dept_channel_messages.channel_id and dm.user_id = auth.uid()
  )
);

-- 채널 메시지 전송: 내가 그 채널의 부서 멤버일 때
create policy "dept_channel_messages_insert" on dept_channel_messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from dept_channels c
    join department_members dm on dm.department_id = c.department_id
    where c.id = dept_channel_messages.channel_id and dm.user_id = auth.uid()
  )
);

-- 번역 캐시 조회: 내가 속한 부서 채널의 메시지면
create policy "dept_channel_translations_select" on dept_channel_translations for select using (
  exists (
    select 1 from dept_channel_messages m
    join dept_channels c on c.id = m.channel_id
    join department_members dm on dm.department_id = c.department_id
    where m.id = dept_channel_translations.message_id and dm.user_id = auth.uid()
  )
);

-- 읽음 기록 조회/수정: 본인만
create policy "dept_channel_reads_select" on dept_channel_reads for select using (
  user_id = auth.uid()
);
create policy "dept_channel_reads_insert" on dept_channel_reads for insert with check (
  user_id = auth.uid()
);
create policy "dept_channel_reads_update" on dept_channel_reads for update using (
  user_id = auth.uid()
);

-- Realtime 활성화
alter publication supabase_realtime add table dept_channel_messages;
