-- 팀원 접속 상태(presence) 실시간 반영 수정
-- profiles 테이블이 supabase_realtime publication에 빠져 있어
-- presence UPDATE 이벤트가 다른 클라이언트로 푸시되지 않던 문제 해결.
-- (profiles는 RLS 미활성 → 추가 시 모든 구독 클라이언트로 브로드캐스트)
alter publication supabase_realtime add table profiles;
