-- ============================================================
-- 【適用後の確認・読み取りだけ】翻訳の SQL 案（proposal_content_translations.sql・proposal_account_deletion_requests.sql）
-- を適用したあとに、作られたものと権限・初期値が想定どおりかを確かめる。何も書きかえない（SELECT だけ）。
--
-- 使い方：Supabase → SQL Editor に貼って Run。ok が false の行があれば、翻訳を有効にしないでください。
-- ============================================================
with
expected_tables(name) as (values
  ('translation_settings'),('translation_consents'),('translation_item_permissions'),('translation_consent_events'),
  ('translation_consent_notices'),('translation_provision_log'),('content_translations'),('translation_budget'),
  ('translation_reservations'),('translation_daily'),('translation_age_gate')),
expected_functions(name) as (values
  ('translation_consent_current'),('translation_first_text'),('translatable_source'),('get_translation'),('claim_translation'),
  ('release_translation'),('store_translation'),('begin_translation_provision'),('finish_translation_provision'),('halt_translation'),
  ('reserve_translation'),('settle_translation'),('translation_candidates'),('translation_items_valid'),('translation_replace_items'),
  ('grant_translation_consent'),('set_translation_items'),('revoke_translation_consent'),('get_translation_consent'),
  ('owner_allows_translation'),('purge_translation_legal_records'),('purge_translation_cost_records'),('purge_translation_cache')),
t as (
  select e.name, c.oid, c.relrowsecurity,
         has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select')
      or has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('authenticated', c.oid, 'insert') as client_access,
         (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = e.name) as policies
    from expected_tables e left join pg_class c on c.relname = e.name and c.relnamespace = 'public'::regnamespace),
f as (
  select e.name, p.oid, p.prosecdef, p.proconfig,
         coalesce(has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'), false) as client_exec
    from expected_functions e left join pg_proc p on p.proname = e.name and p.pronamespace = 'public'::regnamespace),
checks(ord, check_name, ok, detail) as (
  select 1, 'テーブルが 11 個ある', (select count(*) from t where oid is not null) = 11,
         coalesce((select string_agg(name, ',') from t where oid is null), '')
  union all select 2, 'すべて RLS 有効・ポリシーなし', not exists (select 1 from t where not relrowsecurity or policies > 0),
         coalesce((select string_agg(name, ',') from t where not relrowsecurity or policies > 0), '')
  union all select 3, 'anon・authenticated から読み書きできない', not exists (select 1 from t where client_access),
         coalesce((select string_agg(name, ',') from t where client_access), '')
  union all select 4, '関数が 23 個ある', (select count(distinct name) from f where oid is not null) = 23,
         coalesce((select string_agg(name, ',') from f where oid is null), '')
  union all select 5, '関数はすべて SECURITY DEFINER（translation_first_text を除く）・search_path 固定',
         not exists (select 1 from f where oid is not null and name <> 'translation_first_text' and (not prosecdef or not (proconfig::text like '%search_path=public%'))), ''
  union all select 6, 'anon・authenticated は関数を実行できない', not exists (select 1 from f where client_exec),
         coalesce((select string_agg(name, ',') from f where client_exec), '')
  union all select 7, 'トリガー（profile_book・answers）',
         (select count(*) from information_schema.triggers where trigger_name in ('profile_book_purge_translations','answers_purge_translations')) >= 2, ''
  union all select 8, '初期値：翻訳は止まっている（enabled = false）', (select not enabled from public.translation_settings), ''
  union all select 9, '初期値：止めた理由なし・上限 $10・目安 $5', (select halted_reason is null and monthly_cap_usd = 10 and monthly_target_usd = 5 from public.translation_settings), ''
  union all select 10, '初期値：料金は米国内の推論（入力 $0.11・出力 $0.55 / 100 万トークン）',
         (select price_input_per_mtok = 0.11 and price_output_per_mtok = 0.55 from public.translation_settings), ''
  union all select 11, '初期値：法定の記録の保存期間 3 年・費用の明細 13 か月・年齢の再入力 7 日',
         (select legal_record_retention = interval '3 years' and cost_record_retention = interval '13 months' and age_retry = interval '7 days' from public.translation_settings), ''
  union all select 12, '送信の記録は米国指定だけ（requested_geo の制約）',
         exists (select 1 from pg_constraint where conrelid = 'public.translation_provision_log'::regclass and pg_get_constraintdef(oid) like '%requested_geo%''us''%'), ''
  union all select 13, '費用の表に個人の ID の列がない',
         not exists (select 1 from information_schema.columns where table_schema = 'public'
                      and table_name in ('translation_budget','translation_reservations') and column_name in ('user_id','owner_id')), ''
  union all select 14, '翻訳のテーブルに生年月の列がない',
         not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name like 'translation%' and column_name ~ 'birth'), ''
  union all select 15, '法定の記録は外部キーなし（退会後も残る）',
         not exists (select 1 from pg_constraint where contype = 'f'
                      and conrelid in ('public.translation_consent_events'::regclass, 'public.translation_provision_log'::regclass)), ''
  union all select 16, '退会の申請：テーブル・RLS・ポリシー 2 つ（なければ未適用。feedback で受けている）',
         coalesce((select relrowsecurity from pg_class where relname = 'account_deletion_requests' and relnamespace = 'public'::regnamespace), false)
     and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'account_deletion_requests') = 2, ''
  union all select 17, '記録の件数（適用直後はすべて 0）', true,
         (select count(*) from public.translation_consent_events)::text || ' / ' || (select count(*) from public.translation_provision_log)::text
         || ' / ' || (select count(*) from public.content_translations)::text
)
select check_name as check, ok, detail from checks order by ord;

-- 自動削除の予約の確認（pg_cron を有効にしたあとで、別に実行）
-- select jobname, schedule, command from cron.job where command like '%purge_translation%' or command like '%purge_account_deletion%';
