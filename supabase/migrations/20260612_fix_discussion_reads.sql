-- project_discussion_reads 테이블이 누락되어 토론 '읽음' 저장이 안 되던 문제 복구.
-- (원본 20260605_project_discussions.sql 중 이 테이블 부분만 다시 적용)
create table if not exists project_discussion_reads (
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  last_read_at timestamptz default now(),
  primary key (project_id, user_id)
);

alter table project_discussion_reads enable row level security;

drop policy if exists "project_reads_select" on project_discussion_reads;
create policy "project_reads_select" on project_discussion_reads for select using (auth.uid() = user_id);

drop policy if exists "project_reads_insert" on project_discussion_reads;
create policy "project_reads_insert" on project_discussion_reads for insert with check (auth.uid() = user_id);

drop policy if exists "project_reads_update" on project_discussion_reads;
create policy "project_reads_update" on project_discussion_reads for update using (auth.uid() = user_id);
