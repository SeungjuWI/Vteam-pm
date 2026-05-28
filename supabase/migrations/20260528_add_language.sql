-- 프로필에 모국어 필드 추가
alter table profiles
  add column if not exists language text default 'ko';
