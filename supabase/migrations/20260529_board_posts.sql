-- 게시판 (공지/자유 게시글)
create table board_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  author_language text default 'ko',
  created_at timestamptz default now()
);

create index idx_board_posts_company on board_posts (company_id, created_at desc);

-- 번역 캐시
create table board_post_translations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references board_posts(id) on delete cascade not null,
  target_language text not null,
  translated_content text not null,
  created_at timestamptz default now(),
  unique(post_id, target_language)
);

create index idx_board_translations_lookup on board_post_translations (post_id, target_language);

-- RLS
alter table board_posts enable row level security;
alter table board_post_translations enable row level security;

-- 같은 회사 멤버만 조회
create policy "board_posts_select" on board_posts for select using (
  exists (
    select 1 from profiles p where p.id = auth.uid() and p.company_id = board_posts.company_id
  )
);

-- 같은 회사 멤버면 작성 가능
create policy "board_posts_insert" on board_posts for insert with check (
  auth.uid() = author_id
  and exists (
    select 1 from profiles p where p.id = auth.uid() and p.company_id = board_posts.company_id
  )
);

-- 본인 글만 삭제
create policy "board_posts_delete" on board_posts for delete using (
  auth.uid() = author_id
);

-- 번역 캐시: 같은 회사면 조회 가능
create policy "board_translations_select" on board_post_translations for select using (
  exists (
    select 1 from board_posts bp
    join profiles p on p.company_id = bp.company_id
    where bp.id = board_post_translations.post_id and p.id = auth.uid()
  )
);

-- Realtime
alter publication supabase_realtime add table board_posts;
