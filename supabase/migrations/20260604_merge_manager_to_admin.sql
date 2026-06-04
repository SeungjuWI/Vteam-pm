-- 역할 체계를 2단계(admin/employee)로 통합
-- 기존 manager 역할을 admin으로 승격하고 role 체크 제약을 갱신한다.

-- 1) 기존 데이터 마이그레이션: manager -> admin
update profiles set role = 'admin' where role = 'manager';

-- 2) role 체크 제약 갱신 (manager 제거)
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('admin', 'employee'));
