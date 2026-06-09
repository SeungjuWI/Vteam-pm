-- 타임라인/마일스톤 실데이터용 통합 마이그레이션
-- 1) 서브태스크 계층 (parent_task_id 가 null=메인, 값=서브)
alter table tasks add column if not exists parent_task_id uuid references tasks(id) on delete cascade;
create index if not exists idx_tasks_parent_task_id on tasks(parent_task_id);

-- 2) 타임라인 막대 시작일 (없으면 마감일 기준 단일 월로 표시)
alter table tasks add column if not exists start_date date;

-- 3) 마일스톤
create table if not exists project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  title text not null,
  date date not null,
  created_at timestamptz default now()
);
create index if not exists idx_milestones_project on project_milestones(project_id);
