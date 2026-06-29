-- Realtime(postgres_changes)가 RLS를 강제하는데, 앱의 모든 읽기는 adminClient(RLS 우회)로
-- 돌기 때문에 그동안 RLS 정책이 실사용되지 않았다. 그 결과 RLS 평가가 막혀도 새로고침(admin)은
-- 정상이라 눈치채지 못했고, 실시간 전달만 죽어 있었다(DM 배지·부서채팅 모두).
-- 이 마이그레이션은 Realtime RLS 평가가 확실히 통과하도록 정책을 정비한다.

-- ① UPDATE/DELETE 이벤트의 RLS 평가에 행 전체 컬럼이 필요 → REPLICA IDENTITY FULL
alter table direct_messages replica identity full;
alter table dept_channel_messages replica identity full;

-- ② DM: 단순 정책(조인 없음) 보장 (멱등)
drop policy if exists dm_select on direct_messages;
create policy "dm_select" on direct_messages for select using (
  auth.uid() = sender_id or auth.uid() = receiver_id
);

-- ③ 채널 멤버십 검사를 SECURITY DEFINER 함수로 캡슐화.
--    조인 대상(dept_channels, department_members)의 RLS 연쇄를 우회하여
--    Realtime RLS 평가가 안정적으로 통과하게 한다.
create or replace function public.is_dept_channel_member(p_channel_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from dept_channels c
    join department_members dm on dm.department_id = c.department_id
    where c.id = p_channel_id and dm.user_id = auth.uid()
  );
$$;

-- ④ 채널 메시지 SELECT 정책을 함수 기반으로 교체 (멱등)
drop policy if exists dept_channel_messages_select on dept_channel_messages;
create policy "dept_channel_messages_select" on dept_channel_messages for select using (
  public.is_dept_channel_member(channel_id)
);
