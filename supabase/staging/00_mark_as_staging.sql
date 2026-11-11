-- ============================================================
-- 【検証用プロジェクトだけで実行】このデータベースが「検証用」であることの印を付ける
--
-- ・既存のテーブル（schema.sql など）を流したあと、最初に 1 回だけ実行する。
-- ・印があるデータベースでしか、seed_test_data.sql・smoke_test_translation.sql は動かない
--   （本番で誤って実行しても、何もせずにエラーで止まる）。
-- ・本番では絶対に実行しない（この印は、検証用の SQL を本番で誤って実行しないための目印）。
-- ・安全のため、テスト用（@example.com）以外のユーザーが 1 人でもいるデータベースでは印を付けない。
--   （本番はユーザーが少ないので、人数では本番と見分けられない。テスト用のアカウントは印を付けたあとに作る）
-- ============================================================
do $$
begin
  -- 確認と印付けを 1 つのブロックにしている：確認で止まれば、どの実行方法でも印は付かない
  if exists (select 1 from auth.users where email is null or lower(email) not like '%@example.com') then
    raise exception 'テスト用（@example.com）以外のユーザーがいます。本番・使用中のデータベースではありませんか？ 印は付けませんでした。';
  end if;
  create table if not exists public._miri_environment (name text primary key check (name = 'staging'), marked_at timestamptz not null default now());
  alter table public._miri_environment enable row level security;   -- ポリシーなし：アプリからは読めない
  revoke all on public._miri_environment from public, anon, authenticated;
  insert into public._miri_environment (name) values ('staging') on conflict do nothing;
end $$;
select name, marked_at from public._miri_environment;
