-- ============================================================
-- 【読み取りだけ・本番でも検証用でも実行できる】すべてのテーブルの行数（SQL の適用前後で、データが変わっていないかを比べる）
-- 使い方：適用の前と後に SQL Editor で Run し、結果を並べて比べる（方針だけを変える 0001・0002 では、すべて同じになるはず）
-- ============================================================
select table_schema || '.' || table_name as table_name,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as row_count
  from information_schema.tables
 where table_type = 'BASE TABLE'
   and (table_schema = 'public' or (table_schema = 'auth' and table_name in ('users', 'identities')) or (table_schema = 'storage' and table_name in ('buckets', 'objects')))
 order by 1;
