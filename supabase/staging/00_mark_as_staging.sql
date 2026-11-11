-- ============================================================
-- 【検証用プロジェクトだけで実行】このデータベースが「検証用」であることの印を付ける
--
-- ・既存のテーブル（schema.sql など）を流したあと、最初に 1 回だけ実行する。
-- ・印があるデータベースでしか、seed_test_data.sql・smoke_test_translation.sql は動かない
--   （本番で誤って実行しても、何もせずにエラーで止まる）。
-- ・本番では絶対に実行しない（この印は、検証用の SQL を本番で誤って実行しないための目印）。
-- ・安全のため、ユーザーが 10 人を超えるデータベースでは印を付けない。
-- ============================================================
do $$
begin
  if (select count(*) from auth.users) > 10 then
    raise exception 'ユーザーが 10 人を超えています。本番のデータベースではありませんか？ 印は付けませんでした。';
  end if;
end $$;
create table if not exists public._miri_environment (name text primary key check (name = 'staging'), marked_at timestamptz not null default now());
alter table public._miri_environment enable row level security;   -- ポリシーなし：アプリからは読めない
revoke all on public._miri_environment from public, anon, authenticated;
insert into public._miri_environment (name) values ('staging') on conflict do nothing;
select name, marked_at from public._miri_environment;
