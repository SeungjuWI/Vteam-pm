-- Vteam DB Schema

-- 회사
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  invite_code text unique,
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
  status text default 'active' check (status in ('pending', 'active', 'inactive')),
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

-- 프로젝트
create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  name text not null,
  description text,
  status text default 'active' check (status in ('active', 'completed', 'on_hold')),
  created_at timestamptz default now()
);

-- 태스크
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) not null,
  assignee_id uuid references profiles(id),
  title text not null,
  description text,
  status text default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  created_at timestamptz default now()
);
