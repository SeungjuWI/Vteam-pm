-- 프로젝트별 월별 OKR (목표 Objective + 핵심결과 Key Result)
-- 진행률은 KR별 수동 퍼센트(0~100), 목표 진행률은 KR 평균으로 계산(앱 단)

create table if not exists okr_objectives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  company_id uuid references companies(id) not null,
  period text not null,                       -- 'YYYY-MM' (월별 스코프)
  title text not null,
  description text,
  owner_id uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists okr_key_results (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid references okr_objectives(id) on delete cascade not null,
  title text not null,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_okr_objectives_project on okr_objectives (project_id, period);
create index if not exists idx_okr_key_results_objective on okr_key_results (objective_id, sort_order);
