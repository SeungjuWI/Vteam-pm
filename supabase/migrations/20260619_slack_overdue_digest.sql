-- 지연 업무 슬랙 알림(다이제스트)
-- 회사별 슬랙 Incoming Webhook 주소 + 사용 여부.
-- 매일 평일 오전 10시(KST) 크론이 이 설정을 보고 지연 업무를 채널로 전송한다.
alter table companies add column if not exists slack_webhook_url text;
alter table companies add column if not exists slack_digest_enabled boolean default false;
