-- ============================================================
-- 【読み取りだけ・本番で実行】検証用と形が違った 3 か所の定義を出す
--
-- schema_fingerprint.sql の比較で、本番だけ違ったもの：
--   handle_new_user()・protect_profile_privileged() の定義、profiles の列。
-- どちらもリポジトリのどの版（過去の版を含む）とも一致しなかったため、本番の定義を確認する。
-- ・1 行目の「set transaction read only」で、書きこみは一切できない。
-- ・出るのは関数の定義文と列の名前・型だけ（利用者のデータは出ない）。
-- ============================================================
set transaction read only;
select 1 as ord, 'handle_new_user の定義' as item, pg_get_functiondef('public.handle_new_user()'::regprocedure) as detail
union all
select 2, 'protect_profile_privileged の定義', pg_get_functiondef('public.protect_profile_privileged()'::regprocedure)
union all
select 3, 'profiles の列（名前:型、! は必須）',
       string_agg(attname || ':' || format_type(atttypid, atttypmod) || case when attnotnull then '!' else '' end, ', ' order by attnum)
  from pg_attribute where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped
order by ord;
