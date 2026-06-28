-- 기존 데이터 정리: 서브태스크가 모두 'done'인데 부모 status가 done이 아닌 메인 태스크를
-- 일괄 완료 처리한다. (지금까지 부모 status가 동기화되지 않아 내 태스크/대시보드에
--  완료한 작업이 '할 일'·'기간 초과'로 계속 남아 있던 문제를 정리)
--
-- ⚠️ 마이그레이션 자동 적용 안 됨 → 프로덕션 Supabase SQL 에디터에서 직접 실행.

update tasks p
set status = 'done'
where p.status <> 'done'
  and exists (
    select 1 from tasks c where c.parent_task_id = p.id
  )
  and not exists (
    select 1 from tasks c where c.parent_task_id = p.id and c.status <> 'done'
  );
