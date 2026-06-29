-- 링크 미리보기(OG 메타) 캐시 테이블
-- /api/link-preview 라우트가 service role(admin)로만 읽고 씀 → 일반 사용자 직접 접근 불필요.
create table if not exists public.link_previews (
  url         text primary key,
  title       text,
  description text,
  image       text,
  site_name   text,
  ok          boolean not null default true,   -- false면 가져오기 실패(미리보기 없음)로 캐시
  fetched_at  timestamptz not null default now()
);

-- RLS 켜고 정책은 두지 않음 → 일반 사용자 차단, admin(service role)만 접근.
alter table public.link_previews enable row level security;
