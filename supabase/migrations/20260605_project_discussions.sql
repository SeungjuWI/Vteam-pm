-- 프로젝트별 토론 (글 + 스레드 답글, 실시간 번역)

-- 글 (단일 피드)
create table project_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  author_language text default 'ko',
  created_at timestamptz default now()
);

create index idx_project_posts_project on project_posts (project_id, created_at desc);

-- 스레드 답글 (글에 열리는 스레드, 1단계 평면 구조)
-- project_id를 비정규화 → 프로젝트 단위 realtime 구독이 가능
create table project_post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references project_posts(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  author_language text default 'ko',
  created_at timestamptz default now()
);

create index idx_project_post_replies_post on project_post_replies (post_id, created_at asc);
create index idx_project_post_replies_project on project_post_replies (project_id);

-- 글 공감
create table project_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references project_posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

create index idx_project_post_reactions_post on project_post_reactions (post_id);

-- 번역 캐시 (글)
create table project_post_translations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references project_posts(id) on delete cascade not null,
  target_language text not null,
  translated_content text not null,
  created_at timestamptz default now(),
  unique(post_id, target_language)
);

create index idx_project_post_translations_lookup on project_post_translations (post_id, target_language);

-- 번역 캐시 (답글)
create table project_reply_translations (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid references project_post_replies(id) on delete cascade not null,
  target_language text not null,
  translated_content text not null,
  created_at timestamptz default now(),
  unique(reply_id, target_language)
);

create index idx_project_reply_translations_lookup on project_reply_translations (reply_id, target_language);

-- 안읽음 추적 (프로젝트별 마지막 읽은 시각)
create table project_discussion_reads (
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  last_read_at timestamptz default now(),
  primary key (project_id, user_id)
);

-- RLS
alter table project_posts enable row level security;
alter table project_post_replies enable row level security;
alter table project_post_reactions enable row level security;
alter table project_post_translations enable row level security;
alter table project_reply_translations enable row level security;
alter table project_discussion_reads enable row level security;

-- 같은 회사 멤버면 프로젝트 토론 조회/작성 가능 (프로젝트 상세 열람 권한과 동일)
create policy "project_posts_select" on project_posts for select using (
  exists (
    select 1 from projects pr
    join profiles p on p.company_id = pr.company_id
    where pr.id = project_posts.project_id and p.id = auth.uid()
  )
);

create policy "project_posts_insert" on project_posts for insert with check (
  auth.uid() = author_id
  and exists (
    select 1 from projects pr
    join profiles p on p.company_id = pr.company_id
    where pr.id = project_posts.project_id and p.id = auth.uid()
  )
);

create policy "project_posts_delete" on project_posts for delete using (
  auth.uid() = author_id
);

create policy "project_replies_select" on project_post_replies for select using (
  exists (
    select 1 from projects pr
    join profiles p on p.company_id = pr.company_id
    where pr.id = project_post_replies.project_id and p.id = auth.uid()
  )
);

create policy "project_replies_insert" on project_post_replies for insert with check (
  auth.uid() = author_id
  and exists (
    select 1 from projects pr
    join profiles p on p.company_id = pr.company_id
    where pr.id = project_post_replies.project_id and p.id = auth.uid()
  )
);

create policy "project_replies_delete" on project_post_replies for delete using (
  auth.uid() = author_id
);

create policy "project_reactions_select" on project_post_reactions for select using (
  exists (
    select 1 from project_posts pp
    join projects pr on pr.id = pp.project_id
    join profiles p on p.company_id = pr.company_id
    where pp.id = project_post_reactions.post_id and p.id = auth.uid()
  )
);

create policy "project_reactions_insert" on project_post_reactions for insert with check (
  auth.uid() = user_id
);

create policy "project_reactions_delete" on project_post_reactions for delete using (
  auth.uid() = user_id
);

create policy "project_post_translations_select" on project_post_translations for select using (
  exists (
    select 1 from project_posts pp
    join projects pr on pr.id = pp.project_id
    join profiles p on p.company_id = pr.company_id
    where pp.id = project_post_translations.post_id and p.id = auth.uid()
  )
);

create policy "project_reply_translations_select" on project_reply_translations for select using (
  exists (
    select 1 from project_post_replies rp
    join projects pr on pr.id = rp.project_id
    join profiles p on p.company_id = pr.company_id
    where rp.id = project_reply_translations.reply_id and p.id = auth.uid()
  )
);

-- 안읽음: 본인 기록만 조회/생성/수정
create policy "project_reads_select" on project_discussion_reads for select using (
  auth.uid() = user_id
);
create policy "project_reads_insert" on project_discussion_reads for insert with check (
  auth.uid() = user_id
);
create policy "project_reads_update" on project_discussion_reads for update using (
  auth.uid() = user_id
);

-- Realtime
-- DELETE 이벤트가 PK 외의 컬럼(project_id, post_id)도 함께 전송하도록 full identity 설정
-- (project_id 필터 + old.post_id 기반 댓글 수 갱신에 필요)
alter table project_posts replica identity full;
alter table project_post_replies replica identity full;

alter publication supabase_realtime add table project_posts;
alter publication supabase_realtime add table project_post_replies;
