-- ============================================================
-- 【読み取りだけ】スキーマの指紋（本番と検証用で同じ形かを比べる）
--
-- 使い方：本番と検証用の両方の SQL Editor で実行し、結果（CSV でダウンロード）を比べる。
--         kind・name・fingerprint がすべて同じなら、テーブル・列・RLS・ポリシー・関数・トリガーが同じ定義。
-- ・1 行目の「set transaction read only」で、書きこみは一切できない。
-- ・データの中身は読まない（定義だけ）。
-- ・検証用だけにあるもの（_miri_environment）と、翻訳の SQL で追加するものは、比べるときに除いてよい。
-- ============================================================
set transaction read only;
with objects(kind, name, def) as (
  select 'table', c.relname,
         'rls=' || c.relrowsecurity || ' cols=' || string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then '!' else '' end, ',' order by a.attnum)
    from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
   group by c.relname, c.relrowsecurity
  union all
  select 'policy', tablename || '.' || policyname, cmd || ' roles=' || roles::text || ' using=' || coalesce(qual, '') || ' check=' || coalesce(with_check, '')
    from pg_policies where schemaname = 'public'
  union all
  select 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', pg_get_functiondef(p.oid)
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  union all
  select 'trigger', c.relname || '.' || t.tgname, pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and (c.relnamespace = 'public'::regnamespace or (c.relnamespace = 'auth'::regnamespace and c.relname = 'users'))
  union all
  select 'grant', table_name || ':' || grantee, string_agg(privilege_type, ',' order by privilege_type)
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
   group by table_name, grantee
)
select kind, name, md5(def) as fingerprint from objects
union all
select 'TOTAL', count(*)::text, md5(string_agg(kind || name || md5(def), '|' order by kind, name)) from objects
order by 1, 2;
