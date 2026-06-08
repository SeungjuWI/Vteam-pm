-- 메인-서브 태스크 계층 추가
-- parent_task_id 가 null 이면 메인태스크, 값이 있으면 그 태스크의 서브태스크
alter table tasks add column if not exists parent_task_id uuid references tasks(id) on delete cascade;
create index if not exists idx_tasks_parent_task_id on tasks(parent_task_id);
