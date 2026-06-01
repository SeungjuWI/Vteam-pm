-- 게시글 공감
create table board_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references board_posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

create index idx_board_reactions_post on board_reactions (post_id);

-- RLS
alter table board_reactions enable row level security;

create policy "board_reactions_select" on board_reactions for select using (
  exists (
    select 1 from board_posts bp
    join profiles p on p.company_id = bp.company_id
    where bp.id = board_reactions.post_id and p.id = auth.uid()
  )
);

create policy "board_reactions_insert" on board_reactions for insert with check (
  auth.uid() = user_id
);

create policy "board_reactions_delete" on board_reactions for delete using (
  auth.uid() = user_id
);
