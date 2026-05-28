-- Vteam DB Schema

-- 회사
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  invite_code text unique,
  business_number text,
  corp_number text,
  phone text,
  address text,
  founded_at date,
  logo_url text,
  created_at timestamptz default now()
);

-- 유저 프로필 + 역할
create table profiles (
  id uuid primary key references auth.users(id),
  email text not null,
  name text not null,
  role text not null check (role in ('admin', 'manager', 'employee')),
  company_id uuid references companies(id),
  avatar_url text,
  position text,
  reports_to uuid references profiles(id),
  status text default 'active' check (status in ('pending', 'active', 'inactive')),
  join_date date,
  created_at timestamptz default now()
);

-- 초대
create table invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  email text not null,
  invited_by uuid references profiles(id) not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz default now()
);

-- 출퇴근
create table attendances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references profiles(id) not null,
  company_id uuid references companies(id) not null,
  clock_in timestamptz not null,
  clock_out timestamptz,
  memo text,
  created_at timestamptz default now()
);

-- 회사 근무 규정
create table company_work_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null unique,
  work_type text default 'flexible' check (work_type in ('fixed', 'flexible', 'free')),
  fixed_start time,
  fixed_end time,
  flexible_start time default '07:00',
  flexible_end time default '11:00',
  required_hours numeric(3,1) default 8,
  lunch_start time default '12:00',
  lunch_duration integer default 60,
  core_time_enabled boolean default false,
  core_time_start time,
  core_time_end time,
  created_at timestamptz default now()
);

-- 회사 연차 설정
create table company_leave_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null unique,
  auto_grant boolean default true,
  default_annual_days integer default 15,
  grant_basis text default 'join_date' check (grant_basis in ('join_date', 'fiscal_year')),
  fiscal_year_start integer default 1,
  first_year_monthly boolean default true,
  longevity_bonus boolean default true,
  max_annual_days integer default 25,
  carry_over boolean default false,
  carry_over_max_days integer default 0,
  annual_promotion boolean default false,
  sick_leave_days integer default 0,
  condolence_leave boolean default true,
  maternity_leave boolean default true,
  paternity_leave boolean default true,
  family_care_days integer default 10,
  created_at timestamptz default now()
);

-- 연차 잔여
create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references profiles(id) not null,
  company_id uuid references companies(id) not null,
  year integer not null,
  total numeric(5,1) not null default 15,
  used numeric(5,1) not null default 0,
  created_at timestamptz default now(),
  unique(employee_id, year)
);

-- 연차 신청
create table leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references profiles(id) not null,
  company_id uuid references companies(id) not null,
  type text not null check (type in ('annual', 'half_am', 'half_pm', 'sick', 'condolence', 'maternity', 'paternity', 'family_care', 'public_duty', 'menstrual', 'compensatory', 'other')),
  start_date date not null,
  start_time time not null,
  end_date date not null,
  end_time time not null,
  duration_hours numeric(5,1) not null,
  reason text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- 프로젝트
create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  name text not null,
  description text,
  image_url text,
  status text default 'active' check (status in ('active', 'completed', 'on_hold')),
  created_at timestamptz default now()
);

-- 프로젝트 멤버 (복수 담당자)
create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  member_id uuid references profiles(id) not null,
  created_at timestamptz default now(),
  unique(project_id, member_id)
);

-- 알림
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  company_id uuid references companies(id) not null,
  type text not null check (type in ('project_invite', 'task_assign', 'general')),
  title text not null,
  message text,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- 태스크
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) not null,
  title text not null,
  description text,
  status text default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  created_at timestamptz default now()
);

-- 태스크 담당자 (복수)
create table task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  member_id uuid references profiles(id) not null,
  created_at timestamptz default now(),
  unique(task_id, member_id)
);

-- 태스크 댓글
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  author_id uuid references profiles(id) not null,
  content text not null,
  created_at timestamptz default now()
);
