-- ============================================================
-- 性格投票パッチ適用後の確認クエリ（読み取りのみ・データは変更しません）
-- SQL Editor に貼って Run → 1つの表で「項目 / 結果 / 期待値 / 判定」が返ります。
-- すべて OK なら適用成功です。
-- ============================================================
with checks as (
  select 1 as no, 'テーブルが存在する' as item,
         coalesce(to_regclass('public.perception_votes')::text, 'NULL') as result,
         'perception_votes' as expected
  union all
  select 2, 'RLS が有効',
         (select relrowsecurity::text from pg_class where oid = 'public.perception_votes'::regclass), 'true'
  union all
  select 3, 'ポリシー（自分の票の参照/追加/変更/取り消しの4つ）',
         (select string_agg(policyname || ':' || cmd, ', ' order by cmd) from pg_policies
           where schemaname = 'public' and tablename = 'perception_votes'),
         'perception delete own:DELETE, perception insert own:INSERT, perception select own:SELECT, perception update own:UPDATE'
  union all
  select 4, '全員が読めるポリシー(using true)が残っていない',
         (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'perception_votes'
            and cmd = 'SELECT' and qual = 'true'), '0'
  union all
  select 5, '未ログイン(anon)のテーブル権限',
         coalesce((select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
            where table_schema = 'public' and table_name = 'perception_votes' and grantee = 'anon'), 'なし'), 'なし'
  union all
  select 6, 'ログイン済み(authenticated)のテーブル権限',
         (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
            where table_schema = 'public' and table_name = 'perception_votes' and grantee = 'authenticated'),
         'DELETE,INSERT,SELECT'
  union all
  select 7, 'ログイン済みが更新できる列',
         (select string_agg(column_name, ',' order by column_name) from information_schema.column_privileges
            where table_schema = 'public' and table_name = 'perception_votes' and grantee = 'authenticated'
              and privilege_type = 'UPDATE'), 'value'
  union all
  select 8, '制約（1人1票・自分不可・カテゴリ・選択肢）',
         (select string_agg(conname, ', ' order by conname) from pg_constraint
            where conrelid = 'public.perception_votes'::regclass and contype in ('u', 'c')),
         'perception_votes_category, perception_votes_not_self, perception_votes_one_vote, perception_votes_value'
  union all
  select 9, '集計関数が存在する',
         coalesce(to_regprocedure('public.get_perception_summary(uuid,text)')::text, 'NULL'),
         'get_perception_summary(uuid,text)'
  union all
  select 10, '集計関数は投票者IDを返さない（戻り列）',
         (select pg_get_function_result('public.get_perception_summary(uuid,text)'::regprocedure)),
         'TABLE(value text, votes bigint, mine boolean)'
  union all
  select 11, '集計関数を実行できるロール',
         (select string_agg(r, ',' order by r) from (
            select 'anon' r where has_function_privilege('anon', 'public.get_perception_summary(uuid,text)', 'execute')
            union all
            select 'authenticated' where has_function_privilege('authenticated', 'public.get_perception_summary(uuid,text)', 'execute')) x),
         'anon,authenticated'
)
select no, item as "確認項目", result as "結果", expected as "期待値",
       case when result = expected then 'OK' else '要確認' end as "判定"
from checks order by no;
