-- ============================================================
-- 【読み取りだけ】既存のプロジェクト（デモ用など）を検証用に使えるかを確かめる
--
-- 使い方：候補のプロジェクトの SQL Editor に全文を貼って Run。結果（check・detail）を共有してください。
-- ・1 行目の「set transaction read only」で、書きこみは一切できない。
-- ・結果に出るのは件数・日付・有無だけ。メールアドレス・名前・文章は出さない。
-- ============================================================
set transaction read only;
with checks(ord, check_name, detail) as (
  select 1, 'ユーザーの数（全体）', (select count(*)::text from auth.users)
  union all select 2, 'テスト用（@example.com）以外のユーザーの数（0 でなければ、印は付けられない）',
         (select count(*)::text from auth.users where email is null or lower(email) not like '%@example.com')
  union all select 3, 'ユーザーのメールのドメインの種類の数（中身は出さない）',
         (select count(distinct split_part(lower(email), '@', 2))::text from auth.users)
  union all select 4, '最後にログインがあった日（使われているかの目安）',
         coalesce((select max(last_sign_in_at)::date::text from auth.users), '(なし)')
  union all select 5, '最後にユーザーが作られた日',
         coalesce((select max(created_at)::date::text from auth.users), '(なし)')
  union all select 6, 'プロフィール / プロフ帳 / 回答 の件数',
         coalesce((select count(*)::text from public.profiles), '-') || ' / '
      || case when to_regclass('public.profile_book') is null then '(表なし)'
              else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.profile_book', false, true, '')))[1]::text end || ' / '
      || case when to_regclass('public.answers') is null then '(表なし)'
              else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.answers', false, true, '')))[1]::text end
  union all select 7, 'アップロードされたファイルの数（Storage）',
         case when to_regclass('storage.objects') is null then '(Storage なし)'
              else (xpath('/row/c/text()', query_to_xml('select count(*) as c from storage.objects', false, true, '')))[1]::text end
  union all select 8, 'public のテーブルの数', (select count(*)::text from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r')
  union all select 9, 'get_visible_book の md5（本番：db438c0404da164099340c14fddd810c）',
         coalesce((select md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'get_visible_book'), '(なし)')
  union all select 10, '翻訳のテーブル・関数がすでにある',
         coalesce((select string_agg(relname, ',') from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
                     and (relname like 'translation\_%' or relname in ('content_translations','account_deletion_requests'))), '(なし)')
  union all select 11, '検証用の印（_miri_environment）', case when to_regclass('public._miri_environment') is null then '(なし)' else 'あり' end
  union all select 12, 'PostgreSQL のバージョン（本番：17.11）', current_setting('server_version')
  union all select 13, '有効な拡張機能',
         coalesce((select string_agg(extname || ' ' || extversion, ', ' order by extname) from pg_extension), '')
)
select check_name as check, detail from checks order by ord;
