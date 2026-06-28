-- 채팅 메시지 수정/삭제 + 이미지/영상/파일 첨부
-- 대상: 개인 DM(direct_messages), 단체 DM(group_dm_messages), 부서 채널(dept_channel_messages)
--
-- ⚠️ 마이그레이션은 자동 적용되지 않음 → 배포 전 프로덕션 Supabase SQL 에디터에 직접 실행할 것.

-- 1) 컬럼 추가 ---------------------------------------------------------------
alter table direct_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,   -- 'image' | 'video' | 'file'
  add column if not exists attachment_name text;

alter table group_dm_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_name text;

alter table dept_channel_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_name text;

-- 첨부만 보낼 때(텍스트 없음) content를 빈 문자열로 저장하므로 not null 제약은 유지.

-- 2) 본인 메시지 수정/삭제 RLS (서버 액션은 admin client로 bypass하지만,
--    Realtime UPDATE 전파 및 방어를 위해 추가) ---------------------------------
drop policy if exists "dm_update_own" on direct_messages;
create policy "dm_update_own" on direct_messages for update using (auth.uid() = sender_id);

drop policy if exists "gdm_messages_update" on group_dm_messages;
create policy "gdm_messages_update" on group_dm_messages for update using (auth.uid() = sender_id);

drop policy if exists "dept_channel_messages_update" on dept_channel_messages;
create policy "dept_channel_messages_update" on dept_channel_messages for update using (auth.uid() = sender_id);

-- 수정/삭제(UPDATE) 이벤트의 변경 전 값까지 Realtime으로 받기 위해 REPLICA IDENTITY FULL
alter table direct_messages replica identity full;
alter table group_dm_messages replica identity full;
alter table dept_channel_messages replica identity full;

-- 3) 채팅 첨부 Storage 버킷 (공개 읽기) --------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- 공개 읽기 / 로그인 사용자 업로드 정책
drop policy if exists "chat_attach_read" on storage.objects;
create policy "chat_attach_read" on storage.objects for select
  using (bucket_id = 'chat-attachments');

drop policy if exists "chat_attach_insert" on storage.objects;
create policy "chat_attach_insert" on storage.objects for insert
  with check (bucket_id = 'chat-attachments' and auth.role() = 'authenticated');
