-- 상태에 '펜딩' 추가 (시작 전/진행 중/펜딩/완료)
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'tasks'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then execute 'alter table tasks drop constraint ' || quote_ident(c); end if;
end $$;
alter table tasks add constraint tasks_status_check check (status in ('todo','in_progress','pending','done'));

-- 결과물 달성 진도율 (0~100)
alter table tasks add column if not exists progress integer default 0;
