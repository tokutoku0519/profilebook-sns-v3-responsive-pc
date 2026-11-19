-- ============================================================
-- 【読み取りだけ・本番でも検証用でも実行できる】0001・0002 が変える方針の「いまの形」を確かめる
--
-- 使い方：SQL Editor に全文を貼って Run。何も書きかえない。
-- 見かた：
--   ・state が「適用前（2026-11-13 の本番と同じ）」なら、0001・0002 の取り消し SQL でこの形に正確に戻せる
--   ・「適用後（0001・0002 と同じ）」なら適用済み
--   ・「どちらとも違う」なら、11-13 のあとに本番の方針が変わっている。適用せず、結果を共有してください
--     （取り消し SQL が、いまの本番の形に戻せない可能性があるため）
-- 期待する値は、手元の「本番の形」のデータベース（PostgreSQL 16）で計算したもの（policies_md5）。
-- PostgreSQL の版によって方針の文字列の書き方がわずかに変わり、同じ方針でも「どちらとも違う」になることがある。
-- そのときは、検証用（本番に合わせ済み・適用前）と本番の policies_md5 が同じかで判断する（同じなら本番も「適用前」の形）。
-- ============================================================
with pol as (
  select tablename, policyname, cmd, coalesce(qual, '') as qual, coalesce(with_check, '') as wc
    from pg_policies
   where schemaname = 'public'
     and tablename in ('circles', 'circle_members', 'circle_posts', 'circle_replies', 'circle_votes',
                       'comments', 'reactions', 'blog_comments', 'blog_likes', 'diary_page_mentions', 'diary_entries')
), h as (
  select count(*) as n, md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || qual || '|' || wc, E'\n'
                                       order by tablename, policyname)) as policies_md5
    from pol
), fn as (
  select count(*) as n from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('circle_viewer_can_see', 'circle_viewer_is_member', 'circle_viewer_is_owner', 'circle_post_viewer_is_member',
                     'circle_post_target_is_member', 'circle_join_status_ok', 'viewer_is_official')
)
select h.n as policies, h.policies_md5, fn.n as helper_functions,
       case
         when h.policies_md5 = '5627ccf9fdae7ebf42989d2374edd2b3' and fn.n = 0 then '適用前（2026-11-13 の本番と同じ）'
         when h.policies_md5 = '2d2954f9a85a788c442fcc495860fcfc'  and fn.n = 7 then '適用後（0001・0002 と同じ）'
         else 'どちらとも違う（適用しないでください。結果を共有してください）'
       end as state
  from h, fn;
