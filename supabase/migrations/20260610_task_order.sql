-- 메인태스크 드래그 정렬
alter table tasks add column if not exists sort_order integer;
