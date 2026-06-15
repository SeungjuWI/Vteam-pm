-- 출퇴근 IP 제한
-- 법인/사무실 단위로 허용 IP(CIDR) 묶음을 'IP 정책'으로 만들고, 유저에게 할당한다.
-- profiles.ip_policy_id 가 null 이면 어디서나 출퇴근 가능(제한 없음).
-- 같은 회사여도 한국법인/베트남법인처럼 허용 IP가 달라, 회사 공통이 아닌 정책 단위로 둔다.

-- 허용 IP 정책 (재사용 묶음)
create table if not exists ip_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) not null,
  name text not null,                      -- 예: "한국법인 사무실"
  cidrs text[] not null default '{}',      -- 예: ['203.0.113.0/24', '1.2.3.4'] (단일 IP 허용)
  created_at timestamptz default now()
);

create index if not exists ip_policies_company_idx on ip_policies(company_id);

-- 유저에게 정책 할당 (null = 제한 없음)
alter table profiles add column if not exists ip_policy_id uuid references ip_policies(id);

-- 출퇴근 시점 IP 기록 (감사/디버깅용, 선택)
alter table attendances add column if not exists ip_address text;
