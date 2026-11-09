-- ============================================================
-- 【適用前の確認・読み取りだけ】本番の Supabase のスキーマが、翻訳の SQL 案の前提と同じかを確かめる
--
-- 使い方：Supabase → SQL Editor → New query に全文を貼って Run。何も書きかえない（SELECT だけ）。
-- 結果の表（check・ok・detail）をコピーして共有してください。ok が false の行があれば、適用しないでください。
-- 前提にしている定義：supabase/schema.sql・supabase/security_patch_A.sql（get_visible_book）
-- ============================================================
with
cols as (
  select table_name, column_name, data_type from information_schema.columns where table_schema = 'public'
),
fn as (
  select p.proname, pg_get_functiondef(p.oid) as def, p.prosecdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_visible_book'
),
checks(ord, check_name, ok, detail) as (
  -- 1. 使うテーブルと列
  select 1, 'profiles(id uuid, username text)',
         exists (select 1 from cols where table_name = 'profiles' and column_name = 'id' and data_type = 'uuid')
     and exists (select 1 from cols where table_name = 'profiles' and column_name = 'username' and data_type = 'text'), ''
  union all select 2, 'profile_book(id uuid, book jsonb)',
         exists (select 1 from cols where table_name = 'profile_book' and column_name = 'id' and data_type = 'uuid')
     and exists (select 1 from cols where table_name = 'profile_book' and column_name = 'book' and data_type = 'jsonb'), ''
  union all select 3, 'answers(id, user_id, question_title, body, visibility, created_at)',
         (select count(*) from cols where table_name = 'answers' and column_name in ('id','user_id','question_title','body','visibility','created_at')) = 6, ''
  union all select 4, 'answers.visibility の値（public/followers/private 以外がないか）',
         not exists (select 1 from public.answers where visibility not in ('public','followers','private')),
         coalesce((select string_agg(distinct visibility, ',') from public.answers), '')
  union all select 5, 'profile_book.__visibility の値（public/followers/private 以外がないか）',
         not exists (select 1 from public.profile_book pb, jsonb_each_text(coalesce(pb.book -> '__visibility', '{}'::jsonb)) v
                      where v.value not in ('public','followers','private')),
         coalesce((select string_agg(distinct v.value, ',') from public.profile_book pb, jsonb_each_text(coalesce(pb.book -> '__visibility', '{}'::jsonb)) v), '')
  -- 2. get_visible_book（ログインしていない人に見える範囲の判定に使う）
  union all select 10, 'get_visible_book(text) がある・SECURITY DEFINER', exists (select 1 from fn where prosecdef), ''
  union all select 11, 'get_visible_book が private を除く', exists (select 1 from fn where def like '%''private''%'), ''
  union all select 12, 'get_visible_book が followers をフォロワーだけに見せる', exists (select 1 from fn where def like '%''followers''%' and def like '%follows%'), ''
  union all select 13, 'get_visible_book が __game・__purchases・__visibility を除く', exists (select 1 from fn where def like '%__game%' and def like '%__purchases%' and def like '%__visibility%'), ''
  union all select 14, 'get_visible_book の定義の md5（共有して、リポジトリの定義と比べる）', true, coalesce((select md5(def) from fn), '(なし)')
  -- 3. 名前のぶつかり（同じ名前のものがすでにあると、案の create if not exists が古い形のまま残る）
  union all select 20, '翻訳のテーブルがまだない',
         not exists (select 1 from information_schema.tables where table_schema = 'public'
                      and (table_name like 'translation\_%' or table_name in ('content_translations','account_deletion_requests'))),
         coalesce((select string_agg(table_name, ',') from information_schema.tables where table_schema = 'public'
                     and (table_name like 'translation\_%' or table_name in ('content_translations','account_deletion_requests'))), '')
  union all select 21, '翻訳の関数がまだない',
         not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and (p.proname like '%translation%' or p.proname like '%account_deletion%')),
         coalesce((select string_agg(p.proname, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and (p.proname like '%translation%' or p.proname like '%account_deletion%')), '')
  union all select 22, 'profile_book・answers の既存のトリガー（追加するトリガーと順番を確認）', true,
         coalesce((select string_agg(event_object_table || ':' || trigger_name, ', ') from information_schema.triggers
                    where event_object_schema = 'public' and event_object_table in ('profile_book','answers')), '(なし)')
  -- 4. 退会の申請（feedback で受けている間の確認）
  union all select 30, 'feedback(user_id, username, kind, body, status, created_at)',
         (select count(*) from cols where table_name = 'feedback' and column_name in ('user_id','username','kind','body','status','created_at')) = 6, ''
  union all select 31, 'feedback の RLS（本人だけ insert / select）', true,
         coalesce((select string_agg(policyname || '=' || cmd, ', ') from pg_policies where schemaname = 'public' and tablename = 'feedback'), '(なし)')
  union all select 32, 'feedback.kind に値を制限する制約がない（account_deletion を入れられる）',
         not exists (select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid
                      where t.relname = 'feedback' and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%kind%'), ''
  union all select 33, '受付中の退会の申請（feedback）', true,
         (select count(*)::text from public.feedback where kind = 'account_deletion' and status = 'new')
  -- 5. 動かすための前提
  union all select 40, 'gen_random_uuid() が使える', exists (select 1 from pg_proc where proname = 'gen_random_uuid'), ''
  union all select 41, 'pg_cron（記録の自動削除に使う。なければダッシュボードで有効にする）', true,
         coalesce((select extversion from pg_extension where extname = 'pg_cron'), '(未有効)')
  union all select 42, 'ロール anon・authenticated・service_role がある',
         (select count(*) from pg_roles where rolname in ('anon','authenticated','service_role')) = 3, ''
  union all select 43, 'データベースの時刻帯（年齢は Asia/Tokyo で計算するので影響しない）', true, current_setting('TimeZone')
  union all select 44, 'PostgreSQL のバージョン', true, current_setting('server_version')
  union all select 45, '件数の目安（プロフィール・回答）', true,
         (select count(*)::text from public.profiles) || ' / ' || (select count(*)::text from public.answers)
)
select check_name as check, ok, detail from checks order by ord;
