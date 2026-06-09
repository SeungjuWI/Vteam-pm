-- 프로젝트 순서(드래그 정렬)
alter table projects add column if not exists sort_order integer;
